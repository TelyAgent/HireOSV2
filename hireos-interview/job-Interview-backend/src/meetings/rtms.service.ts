import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import rtms from '@zoom/rtms';
import { PrismaService } from '../persistence/prisma.service';
import { ZoomHostService } from './zoom-host.service';

// Bridges Zoom RTMS (Realtime Media Streams) to a round's live transcript. One `rtms.Client`
// per active stream, keyed by `rtms_stream_id` (mirrors the SDK's own quickstart pattern —
// a stream id is unique per meeting.rtms_started session, letting multiple rounds stream
// concurrently). The SDK's `client.join()` performs Zoom's own signaling/media WebSocket
// handshake and keep-alive internally; we only handle finding the right round and recording
// what comes back. See https://zoom.github.io/rtms/js/ for the full wire protocol this hides.
@Injectable()
export class RtmsService {
  private readonly logger = new Logger(RtmsService.name);
  private readonly clients = new Map<string, InstanceType<typeof rtms.Client>>();
  // meeting_uuid → numeric meeting id, learned from standard meeting.* webhook events
  // (payload.object.{id, uuid}). RTMS events carry only the uuid, so this map is the
  // bridge back to a round whose meetingLink holds /j/<numeric id>. See handleEvent.
  private readonly uuidToMeetingId = new Map<string, string>();
  // Meetings we have already asked Zoom to stream, so a repeat meeting.started (or a
  // re-delivered webhook) cannot fire a second start request for the same meeting.
  private readonly startRequested = new Set<string>();

  constructor(private readonly config: ConfigService, private readonly db: PrismaService, private readonly zoomHost: ZoomHostService) {}

  // RTMS only starts by itself when the host's account has the app on Zoom's
  // "Apps that access content in meetings" list with auto-start on — an admin-only
  // setting no code of ours can reach. Asking Zoom's own start API the moment a round's
  // meeting begins gets the same result without depending on that toggle: Zoom replies by
  // pushing meeting.rtms_started, which the rtms_started branch below then joins.
  private async requestStream(meetingId: string, roundId: string) {
    if (this.startRequested.has(meetingId)) return;
    this.startRequested.add(meetingId);
    // "Meeting has not started" (3000) is transient — meeting.started can beat the point at
    // which Zoom will accept a stream request — so retry it a couple of times before giving
    // up. A 403 (13262, the app is not on the account's allow-list) or any other 4xx is
    // configuration and will not heal on retry, so those stop immediately.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const token = await this.zoomHost.anyAccessToken();
        if (!token) { this.logger.warn(`RTMS start skipped for meeting ${meetingId}: no connected Zoom account`); break; }
        // Zoom's RTMS REST API requires the primary Client ID of the RTMS app.
        // The Public Client ID is only used for the PKCE OAuth redirect flow.
        const authorizedClientId = this.config.get<string>('ZM_RTMS_CLIENT')?.trim();
        if (!authorizedClientId) {
          await this.markStreamError(roundId, 'ZM_RTMS_CLIENT_REQUIRED');
          this.logger.warn(`RTMS start skipped for meeting ${meetingId}: RTMS client id is empty`);
          break;
        }
        // Follow Zoom's documented meeting-level start request exactly. The access
        // token identifies the host/participant to stream; passing a host_id from
        // meeting.started is unnecessary and can refer to a different identifier
        // namespace than participant_user_id.
        const settings = { client_id: authorizedClientId };
        const response = await fetch(`https://api.zoom.us/v2/live_meetings/${meetingId}/rtms_app/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          // This is the live-participant RTMS status endpoint. The host must be
          // identified explicitly; otherwise Zoom may accept the request without
          // creating the host's RTMS stream.
          body: JSON.stringify({ action: 'start', settings }),
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) { this.logger.log(`RTMS start accepted for meeting ${meetingId}; awaiting meeting.rtms_started`); return; }
        const body = await response.text().catch(() => '');
        this.logger.warn(`RTMS start rejected for meeting ${meetingId} (${response.status}, attempt ${attempt}/3): ${body.slice(0, 400)}`);
        const retryable = response.status >= 500 || /"code"\s*:\s*3000\b/.test(body);
        if (!retryable) {
          const providerCode = body.match(/"code"\s*:\s*(\d+)/)?.[1];
          await this.markStreamError(roundId, `RTMS_START_${response.status}${providerCode ? `_${providerCode}` : ''}`);
          break;
        }
      } catch (error) {
        this.logger.warn(`RTMS start failed for meeting ${meetingId} (attempt ${attempt}/3): ${error instanceof Error ? error.message : error}`);
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
    // Nothing worked: drop the marker so a later meeting.started for this same meeting can
    // try again, instead of the meeting staying unstreamable for its whole duration.
    this.startRequested.delete(meetingId);
    const round = await this.db.interviewRound.findUnique({ where: { id: roundId }, select: { transcriptStatus: true } }).catch(() => null);
    if (round?.transcriptStatus === 'idle') await this.markStreamError(roundId, 'RTMS_START_FAILED');
  }

  private async markStreamError(roundId: string, error: string) {
    await this.db.interviewRound.update({
      where: { id: roundId },
      data: { transcriptStatus: 'error', transcriptError: error },
    }).catch((dbError) => {
      this.logger.warn(`Failed to persist RTMS error for round ${roundId}: ${dbError instanceof Error ? dbError.message : dbError}`);
    });
  }

  /** Start the round's stream after the host has actually joined.
   * This is the reliable path for Meeting SDK web sessions; the meeting.started
   * webhook remains a useful fallback but can arrive before the host media session
   * is ready or be delayed by Zoom's event delivery.
   */
  async startRound(workspaceId: string, roundId: string) {
    const round = await this.db.interviewRound.findFirst({
      where: { id: roundId, workspaceId },
      select: { id: true, meetingLink: true, transcriptStatus: true },
    });
    if (!round) throw new NotFoundException({ code: 'NOT_FOUND' });
    const match = round.meetingLink?.match(/\/j\/(\d+)/);
    if (!match) throw new BadRequestException({ code: 'ZOOM_MEETING_LINK_REQUIRED' });
    if (round.transcriptStatus === 'live' || round.transcriptStatus === 'connecting') {
      return { requested: false, meetingId: match[1], status: round.transcriptStatus };
    }
    await this.db.interviewRound.update({
      where: { id: round.id },
      data: { transcriptStatus: 'connecting', transcriptError: null },
    });
    void this.requestStream(match[1], round.id);
    return { requested: true, meetingId: match[1], status: 'connecting' };
  }

  // The uuid→id map only lives in memory, so a restart between meeting.started and
  // rtms_started loses it — and rtms_started carries nothing but the uuid. Zoom's
  // GET /v2/meetings/{id} accepts a meeting uuid as well as a numeric id (a uuid must be
  // double-encoded), which recovers the numeric id on its own.
  private async resolveMeetingId(uuid: string): Promise<string> {
    const remembered = this.uuidToMeetingId.get(uuid);
    if (remembered) return remembered;
    const token = await this.zoomHost.anyAccessToken();
    if (!token) return '';
    try {
      const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(encodeURIComponent(uuid))}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) { this.logger.warn(`uuid lookup failed for "${uuid}" (${response.status})`); return ''; }
      const body = await response.json().catch(() => ({}));
      const id = body?.id != null && body.id !== '' ? String(body.id) : '';
      if (id) this.uuidToMeetingId.set(uuid, id);
      return id;
    } catch (error) {
      this.logger.warn(`uuid lookup errored for "${uuid}": ${error instanceof Error ? error.message : error}`);
      return '';
    }
  }

  // Zoom's own documented (if imperfect) approach: re-stringify the already-parsed body
  // rather than the original bytes, since createWebhookHandler only ever hands us parsed
  // JSON. See "Webhook Validation" at https://zoom.github.io/rtms/js/.
  verifySignature(body: unknown, timestamp: string | undefined, signature: string | undefined): boolean {
    const secret = this.config.get<string>('ZM_RTMS_WEBHOOK_SECRET');
    if (!secret || !signature || !timestamp) return false;
    const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${JSON.stringify(body)}`).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  urlValidationResponse(plainToken: string) {
    const secret = this.config.get<string>('ZM_RTMS_WEBHOOK_SECRET') || '';
    return { plainToken, encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex') };
  }

  async handleEvent(body: { event?: string; payload?: Record<string, any> }) {
    const event = body?.event;
    const inner = body?.payload || {};
    // The RTMS SDK docs put the stream fields straight on the payload; some Zoom event
    // shapes nest them under payload.object instead — accept both, and join with whichever
    // object actually holds the RTMS fields.
    const object = (inner.object && typeof inner.object === 'object' ? inner.object : {}) as Record<string, any>;
    const source = inner.rtms_stream_id ? inner : object;
    const streamId = source.rtms_stream_id;
    if (typeof event === 'string' && event.includes('rtms_stopped')) {
      if (streamId) { this.clients.get(streamId)?.leave(); this.clients.delete(streamId); }
      return;
    }
    // Standard meeting events (meeting.started, meeting.ended, …) carry BOTH the numeric
    // meeting id (object.id) and the meeting uuid (object.uuid). RTMS events carry only the
    // uuid — the SDK's JoinParams literally has no numeric-id field — so record the
    // uuid→id pair here to bridge rtms_started back to the round's /j/<numeric id> link.
    if (typeof event === 'string' && event.startsWith('meeting.') && !event.includes('rtms')) {
      const uuid = typeof object.uuid === 'string' && object.uuid ? object.uuid : '';
      const numericId = object.id != null && object.id !== '' ? String(object.id) : '';
      if (uuid && numericId) this.uuidToMeetingId.set(uuid, numericId);
      if (uuid && event === 'meeting.ended') {
        this.uuidToMeetingId.delete(uuid);
        if (numericId) this.startRequested.delete(numericId);
      }
      // Only a round's own meeting is worth streaming — the account's default "Live
      // Interview" meeting has no round for transcript lines to belong to.
      if (event === 'meeting.started' && numericId) {
        const round = await this.db.interviewRound.findFirst({ where: { meetingLink: { contains: `/j/${numericId}` } }, select: { id: true, transcriptStatus: true } });
        if (round && ['idle', 'error'].includes(round.transcriptStatus)) {
          if (round.transcriptStatus === 'error') {
            await this.db.interviewRound.update({ where: { id: round.id }, data: { transcriptStatus: 'idle', transcriptError: null } }).catch(() => {});
          }
          void this.requestStream(
            numericId,
            round.id,
          );
        }
      }
      return;
    }
    if (typeof event !== 'string' || !event.includes('rtms_started') || !streamId) return;
    // Identity resolution order: a numeric id straight off the RTMS payload (defensive —
    // the documented shape carries only the uuid) → the uuid remembered from
    // meeting.started → Zoom's own API as a last resort. When none resolves, log the raw
    // shape to correct against.
    const meetingUuid = String(inner.meeting_uuid ?? object.meeting_uuid ?? object.uuid ?? '');
    let meetingId = String(inner.id ?? inner.meeting_id ?? object.id ?? '');
    if (!meetingId && meetingUuid) meetingId = await this.resolveMeetingId(meetingUuid);
    const round = meetingId
      ? await this.db.interviewRound.findFirst({ where: { meetingLink: { contains: `/j/${meetingId}` } }, select: { id: true, workspaceId: true } })
      : null;
    if (!round) { this.logger.warn(`rtms_started: no round matched (meetingId="${meetingId}", uuid="${meetingUuid}"). Raw payload: ${JSON.stringify(inner)}`); return; }
    await this.db.interviewRound.update({ where: { id: round.id }, data: { transcriptStatus: 'connecting', transcriptError: null } });
    const client = new rtms.Client();
    this.clients.set(streamId, client);
    client.onTranscriptData((data: unknown, _size: number, _timestamp: number, metadata: { userName?: string }) => {
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      if (!text.trim()) return;
      void this.db.transcriptLine.create({ data: { workspaceId: round.workspaceId, roundId: round.id, speaker: metadata?.userName || 'Speaker', text } })
        .catch((error) => this.logger.error(`Failed to store transcript line for round ${round.id}: ${error instanceof Error ? error.message : error}`));
    });
    client.onJoinConfirm(() => {
      void this.db.interviewRound.update({ where: { id: round.id }, data: { transcriptStatus: 'live' } }).catch(() => {});
    });
    client.onLeave((reason: unknown) => {
      this.clients.delete(streamId);
      void this.db.interviewRound.update({ where: { id: round.id }, data: { transcriptStatus: 'ended', transcriptError: reason ? String(reason) : null } }).catch(() => {});
    });
    try {
      // The callback alone does not request transcript media from the RTMS SDK.
      // Explicitly enable transcript delivery before joining the stream.
      const transcriptConfigured = (client as unknown as {
        setTranscriptParams: (params: { enableLid: boolean }) => boolean;
      }).setTranscriptParams({ enableLid: true });
      if (!transcriptConfigured) {
        this.logger.error(`RTMS transcript configuration rejected for round ${round.id}`);
        this.clients.delete(streamId);
        await this.markStreamError(round.id, 'TRANSCRIPT_CONFIG_FAILED');
        return;
      }
      const joined = client.join(source as any);
      if (!joined) {
        this.logger.error(`RTMS join returned false for round ${round.id}`);
        this.clients.delete(streamId);
        await this.markStreamError(round.id, 'JOIN_REJECTED');
      }
    } catch (error) {
      this.logger.error(`RTMS join failed for round ${round.id}: ${error instanceof Error ? error.message : error}`);
      this.clients.delete(streamId);
      await this.db.interviewRound.update({ where: { id: round.id }, data: { transcriptStatus: 'error', transcriptError: 'JOIN_FAILED' } }).catch(() => {});
    }
  }
}

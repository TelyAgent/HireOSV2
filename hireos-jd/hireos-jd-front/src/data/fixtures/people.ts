/** People & workspace fixtures — ported verbatim from the prototype. */
import type { Person } from "../types";

export const PEOPLE: Record<string, Person> = {
  maya:   { id:'maya',   name:'Maya Chen',  role:'HM',        title:'Hiring Manager, Engineering', email:'maya.chen@sendinglabs.com', color:'#1a73e8', initials:'MC' },
  linh:   { id:'linh',   name:'Linh Tran',  role:'Recruiter', title:'Talent Acquisition Lead',       email:'linh.tran@sendinglabs.com', color:'#188038', initials:'LT' },
  alex:   { id:'alex',   name:'Alex Park',  role:'HR Approver', title:'Head of People',              email:'alex.park@sendinglabs.com', color:'#8430ce', initials:'AP' },
  sam:    { id:'sam',    name:'Sam Reed',   role:'Finance',   title:'Finance Business Partner',      email:'sam.reed@sendinglabs.com',  color:'#b06000', initials:'SR' },
  jamie:  { id:'jamie',  name:'Jamie Cole', role:'Viewer',    title:'Engineering Interviewer',       email:'jamie.cole@sendinglabs.com', color:'#5f6368', initials:'JC' },
};

export const WORKSPACE = { id:'ws-demo', name:'Sending Labs', domain:'sendinglabs.com' };

export function getPerson(id?: string | null): Person | undefined {
  return id ? PEOPLE[id] : undefined;
}

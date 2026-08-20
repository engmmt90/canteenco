import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { addPickupSlot, deletePickupSlot, saveSchoolSettings, togglePickupSlot } from "@/app/actions/school-settings";

export default async function SchoolSettingsPage({params}:{params:Promise<{id:string}>}){
  const session=await requireAdmin();
  const {id}=await params;
  if(session.user.role==="SCHOOL_ADMIN"&&session.user.schoolId!==id) notFound();

  const school=await prisma.school.findUnique({
    where:{id},
    include:{
      settings:true,
      pickupSlots:{orderBy:[{sortOrder:"asc"},{startTime:"asc"}]},
    },
  });
  if(!school) notFound();
  const s=school.settings;

  return <main className="content">
    <div className="page-heading">
      <div><h1 className="brand">{school.name} Settings</h1><p className="subtle">Control pre-orders, pickup times, overdraft policy and notification channels.</p></div>
      <Link className="secondary" href="/admin/schools">Schools</Link>
    </div>

    <div className="wallet-layout">
      <form action={saveSchoolSettings} className="panel form">
        <h2>Operational Settings</h2>
        <input type="hidden" name="schoolId" value={school.id}/>
        <label className="label">Timezone<input className="input" name="timezone" defaultValue={s?.timezone??"Australia/Brisbane"}/></label>
        <label className="label">Currency<input className="input" name="currency" defaultValue={s?.currency??"AUD"}/></label>

        <label><input type="checkbox" name="preOrderEnabled" defaultChecked={s?.preOrderEnabled??true}/> Pre-orders enabled</label>
        <label className="label">Pre-order cutoff time<input className="input" type="time" name="preOrderCutoffTime" defaultValue={s?.preOrderCutoffTime??"07:00"}/></label>

        <label><input type="checkbox" name="allowNegativeBalance" defaultChecked={s?.allowNegativeBalance??false}/> Allow negative-balance sales with admin approval</label>
        <label className="label">Minimum allowed balance<input className="input" type="number" step=".01" min="-1000" max="0" name="minimumAllowedBalance" defaultValue={s?.minimumAllowedBalance?.toString()??"0"}/></label>

        <label><input type="checkbox" name="emailNotificationsEnabled" defaultChecked={s?.emailNotificationsEnabled??true}/> Email notifications enabled for this school</label>
        <label><input type="checkbox" name="smsNotificationsEnabled" defaultChecked={s?.smsNotificationsEnabled??false}/> SMS notifications enabled for this school</label>

        <button className="primary">Save Settings</button>
      </form>

      <section className="panel">
        <h2>Pickup Slots</h2>
        <form action={addPickupSlot} className="form">
          <input type="hidden" name="schoolId" value={school.id}/>
          <input className="input" name="label" placeholder="9:00–9:15" required/>
          <div className="two-col">
            <label className="label">Start<input className="input" type="time" name="startTime" required/></label>
            <label className="label">End<input className="input" type="time" name="endTime" required/></label>
          </div>
          <input className="input" name="sortOrder" type="number" defaultValue="0" placeholder="Sort order"/>
          <button className="primary">Add Pickup Slot</button>
        </form>

        <div className="divider"/>
        <div className="request-list">
          {school.pickupSlots.length===0?<p className="subtle compact">No pickup slots configured.</p>:school.pickupSlots.map(slot=>
            <div className="list-row" key={slot.id}>
              <div><strong>{slot.label}</strong><div className="subtle compact">{slot.startTime}–{slot.endTime} · {slot.isActive?"ACTIVE":"INACTIVE"}</div></div>
              <div className="actions-row">
                <form action={togglePickupSlot}><input type="hidden" name="id" value={slot.id}/><button className="secondary">{slot.isActive?"Disable":"Enable"}</button></form>
                <form action={deletePickupSlot}><input type="hidden" name="id" value={slot.id}/><button className="danger">Remove</button></form>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  </main>
}

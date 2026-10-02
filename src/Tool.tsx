// Betweenly: therapists send short worksheets between sessions and read the answers before the next one.
import { useState } from "react";
import { shareLink, openLater, waLink } from "./lib/share";
import { uid, useCopy, useStored } from "./lib/store";
import { useShared } from "./lib/useShared";
import { todayISO } from "./lib/time";
import { Section, SharedNotice } from "./ui/kit";

const T = "betweenly";
type Field = { key: string; label: string; kind: "text" | "long" | "scale" };
type Sheet = { id: string; title: string; intro: string; fields: Field[]; repeat: boolean };
const SHEETS: Sheet[] = [
  { id: "thought", title: "Thought record", intro: "When you notice a strong feeling, pause and fill this in.", repeat: true, fields: [
    { key: "situation", label: "What happened? Where, when, who with?", kind: "long" }, { key: "thought", label: "What went through your mind?", kind: "long" }, { key: "emotion", label: "Emotion and how strong (0 to 10)", kind: "scale" },
    { key: "for", label: "Evidence that the thought is true", kind: "long" }, { key: "against", label: "Evidence that it is not completely true", kind: "long" }, { key: "balanced", label: "A more balanced thought", kind: "long" }, { key: "after", label: "How strong is the emotion now? (0 to 10)", kind: "scale" }] },
  { id: "mood", title: "Daily mood check-in", intro: "Takes one minute. Fill it in at the same time each day.", repeat: true, fields: [{ key: "mood", label: "Mood today (0 low, 10 great)", kind: "scale" }, { key: "sleep", label: "Sleep quality (0 to 10)", kind: "scale" }, { key: "best", label: "Best moment of the day", kind: "text" }, { key: "hard", label: "Hardest moment", kind: "text" }] },
  { id: "exposure", title: "Exposure practice", intro: "Record each practice, even the short ones.", repeat: true, fields: [{ key: "what", label: "What did you practise?", kind: "text" }, { key: "before", label: "Anxiety before (0 to 10)", kind: "scale" }, { key: "peak", label: "Anxiety at its highest", kind: "scale" }, { key: "end", label: "Anxiety at the end", kind: "scale" }, { key: "learned", label: "What did you learn?", kind: "long" }] },
  { id: "values", title: "Values reflection", intro: "One reflection before our next session.", repeat: false, fields: [{ key: "matters", label: "What matters most to you right now?", kind: "long" }, { key: "gap", label: "Where does your week not match that?", kind: "long" }, { key: "step", label: "One small step you could take", kind: "text" }] },
];
type Assignment = { id: string; client: string; therapist: string; phone: string; sheets: string[]; note: string; sent: string };
type Answer = { sheet: string; at: string; values: Record<string, string> };
type Response = { assignment: string; client: string; answers: Answer[]; returned: string };

function Form({ sheet, onSave }: { sheet: Sheet; onSave: (v: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="note">{sheet.intro}</p>
      {sheet.fields.map(f => (
        <label key={f.key} className="field"><span>{f.label}</span>
          {f.kind === "scale" ? <div className="row" style={{ alignItems: "center" }}><input type="range" min={0} max={10} value={v[f.key] ?? "5"} onChange={e => setV({ ...v, [f.key]: e.target.value })} style={{ flex: 1 }} /><b className="num" style={{ width: 28 }}>{v[f.key] ?? "5"}</b></div>
            : f.kind === "long" ? <textarea className="input" rows={3} value={v[f.key] ?? ""} onChange={e => setV({ ...v, [f.key]: e.target.value })} />
              : <input className="input" value={v[f.key] ?? ""} onChange={e => setV({ ...v, [f.key]: e.target.value })} />}
        </label>
      ))}
      <button className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => { onSave(Object.fromEntries(sheet.fields.map(f => [f.key, v[f.key] ?? (f.kind === "scale" ? "5" : "")]))); setV({}); }}>Save entry</button>
    </div>
  );
}

function AnswerView({ a }: { a: Answer }) {
  const s = SHEETS.find(x => x.id === a.sheet);
  return <div className="bt-ans"><p className="eyebrow">{s?.title} · {new Date(a.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>{s?.fields.map(f => <p key={f.key}><span className="note">{f.label}</span><br />{f.kind === "scale" ? <strong>{a.values[f.key]}/10</strong> : a.values[f.key] || <em className="note">No answer</em>}</p>)}</div>;
}

export default function Betweenly() {
  const shared = useShared<Assignment | Response>();
  const [assigns, setAssigns] = useStored<Assignment[]>(T, "assigns", []);
  const [responses, setResponses] = useStored<Response[]>(T, "responses", []);
  const [therapist, setTherapist] = useStored(T, "therapist", "Dr. Amel");
  const [tPhone, setTPhone] = useStored(T, "tphone", "");
  const [myWork, setMyWork] = useStored<{ a: Assignment | null; answers: Answer[] }>(T, "client", { a: null, answers: [] });
  const [d, setD] = useState({ client: "", phone: "", sheets: ["mood", "thought"], note: "See you next Tuesday. Try to fill the mood check-in every evening." });
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [returned, setReturned] = useState("");
  const { copy, copied } = useCopy();
  const css = <style>{`.bt-ans{padding:12px;border-radius:10px;background:var(--sunk);display:grid;gap:6px}.bt-sheet{border:1px solid var(--line);border-radius:10px;padding:14px}`}</style>;

  if (shared.loading) return <p className="empty-note">Opening…</p>;
  // A client opened an assignment link.
  if (shared.data && shared.mode === "assign") {
    const a = shared.data as Assignment;
    const work = myWork.a?.id === a.id ? myWork : { a, answers: [] };
    const save = (sheet: string, values: Record<string, string>) => setMyWork({ a, answers: [...work.answers, { sheet, at: new Date().toISOString(), values }] });
    return (
      <div className="stack">{css}
        <SharedNotice><p className="eyebrow">From {a.therapist}</p><h2 style={{ margin: "6px 0" }}>Your practice for this week</h2><p>{a.note}</p><p className="note">Your answers stay on this phone until you choose to send them.</p></SharedNotice>
        {a.sheets.map(id => { const s = SHEETS.find(x => x.id === id)!; const mine = work.answers.filter(x => x.sheet === id); return (
          <Section key={id} title={s.title} aside={<span className="pill">{mine.length} saved</span>}>
            {(s.repeat || !mine.length) && <Form sheet={s} onSave={v => save(id, v)} />}
            <div className="stack" style={{ gap: 8, marginTop: 12 }}>{mine.map((x, i) => <AnswerView key={i} a={x} />)}</div>
          </Section>); })}
        <section className="panel stack" style={{ gap: 10 }}>
          <h2>Send your answers to {a.therapist}</h2>
          <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={!work.answers.length} onClick={async () => setReturned(await shareLink(T, { assignment: a.id, client: a.client, answers: work.answers, returned: new Date().toISOString() } as Response, "m=response"))}>Prepare my answers</button>
          {returned && <div className="row"><button className="btn" onClick={() => copy(returned)}>{copied ? "Copied" : "Copy link"}</button><a className="btn" href={waLink(`My answers for this week: ${returned}`, a.phone)} target="_blank" rel="noreferrer">Send on WhatsApp</a></div>}
        </section>
      </div>
    );
  }
  // The therapist opened a returned-answers link.
  if (shared.data && shared.mode === "response") {
    const r = shared.data as Response;
    const known = responses.some(x => x.assignment === r.assignment && x.returned === r.returned);
    return (
      <div className="stack">{css}
        <Section title={`Answers from ${r.client}`} aside={known ? <span className="pill good">Saved</span> : <button className="btn primary small" onClick={() => setResponses([...responses, r])}>Save to {r.client}'s file</button>}>
          <div className="stack" style={{ gap: 10 }}>{r.answers.map((a, i) => <AnswerView key={i} a={a} />)}</div>
        </Section>
        <a className="btn" href="/t/betweenly" style={{ alignSelf: "flex-start" }}>Back to my clients</a>
      </div>
    );
  }

  const clients = [...new Set(assigns.map(a => a.client))];
  return (
    <div className="stack">{css}
      <div className="grid2">
        <Section title="Assign practice">
          <div className="stack" style={{ gap: 10 }}>
            <div className="row"><label className="field"><span>Client (first name or initials)</span><input id="bt-c" className="input" value={d.client} onChange={e => setD({ ...d, client: e.target.value })} /></label><label className="field"><span>Client WhatsApp</span><input id="bt-p" className="input" value={d.phone} onChange={e => setD({ ...d, phone: e.target.value })} /></label></div>
            <div className="field"><span>Worksheets</span><div className="stack" style={{ gap: 4 }}>{SHEETS.map(s => <label key={s.id} className="check"><input type="checkbox" checked={d.sheets.includes(s.id)} onChange={e => setD({ ...d, sheets: e.target.checked ? [...d.sheets, s.id] : d.sheets.filter(x => x !== s.id) })} />{s.title}</label>)}</div></div>
            <label className="field"><span>Message</span><textarea id="bt-note" className="input" rows={2} value={d.note} onChange={e => setD({ ...d, note: e.target.value })} /></label>
            <div className="row"><label className="field"><span>Your name as clients see it</span><input id="bt-t" className="input" value={therapist} onChange={e => setTherapist(e.target.value)} /></label><label className="field"><span>Your WhatsApp, for answers</span><input id="bt-tp" className="input" value={tPhone} onChange={e => setTPhone(e.target.value)} /></label></div>
            <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={!d.client.trim() || !d.sheets.length} onClick={() => {
              const a: Assignment = { id: uid(), client: d.client.trim(), therapist, phone: tPhone, sheets: d.sheets, note: d.note, sent: todayISO() };
              setAssigns([a, ...assigns]);
              openLater(async () => waLink(`Hi ${a.client}, here is your practice for this week: ${await shareLink(T, a, "m=assign")}`, d.phone));
            }}>Send to client</button>
          </div>
        </Section>
        <Section title="Worksheets">
          <div className="stack" style={{ gap: 10 }}>{SHEETS.map(s => <div key={s.id} className="bt-sheet"><strong>{s.title}</strong><p className="note">{s.fields.length} questions · {s.repeat ? "can be filled many times" : "once"}</p></div>)}</div>
        </Section>
      </div>
      <Section title="Clients">
        {clients.length === 0 ? <p className="empty-note">Assigned practice and returned answers appear here.</p> : clients.map(c => { const rs = responses.filter(r => r.client === c); return (
          <div key={c} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong>{c}</strong><span className="row" style={{ gap: 6 }}><span className="pill">{assigns.filter(a => a.client === c).length} assignments</span><span className={"pill " + (rs.length ? "good" : "")}>{rs.reduce((n, r) => n + r.answers.length, 0)} answers back</span><button className="btn small" onClick={() => setOpenClient(openClient === c ? null : c)}>{openClient === c ? "Hide" : "Read"}</button></span></div>
            {openClient === c && <div className="stack" style={{ gap: 8, marginTop: 10 }}>{rs.flatMap(r => r.answers).sort((a, b) => b.at.localeCompare(a.at)).map((a, i) => <AnswerView key={i} a={a} />)}</div>}
          </div>); })}
        <p className="note" style={{ marginTop: 12 }}>Answers travel inside the links, not through a server. Links hold personal information, so send them only to the right person. Everything saved here stays on this device.</p>
      </Section>
    </div>
  );
}

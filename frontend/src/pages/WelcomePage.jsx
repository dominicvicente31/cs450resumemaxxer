import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Job alignment",
    body: "Paste a job posting and get a 0-100 grade on how well your resume covers its keywords and backs them up with real experience.",
  },
  {
    title: "Rewritten bullets",
    body: "See each bullet rewritten next to your original, with writing advice. Anything we can't trace to your resume is flagged.",
  },
  {
    title: "Primary resume and history",
    body: "Save your main resume once and check it against new postings. Your last 30 evaluations are kept so you can compare drafts.",
  },
];

export default function WelcomePage() {
  return (
    <section className="welcome">
      <h1>Turn your coursework and early experience into a resume that gets read.</h1>
      <p className="lede">
        Resume Maxxer reviews your resume for students and recent graduates. Upload a draft and
        get an alignment grade, a clarity score, and rewritten bullets that stay true to what you
        actually did.
      </p>
      <div className="feature-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
      <div className="actions">
        <Link to="/upload" className="button primary">Get started</Link>
        <Link to="/history" className="button">View past submissions</Link>
      </div>
    </section>
  );
}

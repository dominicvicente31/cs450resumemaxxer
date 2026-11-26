import { Link } from "react-router-dom";

const FEATURES = [
  {
    title: "Job match",
    body: "Paste a job posting and see how closely your resume matches it, plus the keywords you're missing.",
  },
  {
    title: "Writing advice",
    body: "Get specific suggestions on wording, structure, and what recruiters look for.",
  },
  {
    title: "Rewritten bullets",
    body: "See each bullet rewritten next to your original. Anything we can't trace to your resume is flagged.",
  },
];

export default function WelcomePage() {
  return (
    <section className="welcome">
      <h1>Turn your coursework and early experience into a resume that gets read.</h1>
      <p className="lede">
        Resume Maxxer reviews your resume for students and recent graduates. Upload a draft and
        get a clarity score, a job match score, and rewritten bullets that stay true to what you
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

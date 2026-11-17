import type { Materials } from "@/lib/schema";

export type PrintVariant = "student" | "mentor";

/**
 * Печатная версия материалов (→ «Сохранить как PDF» в окне печати).
 * На экране скрыта (hidden print:block), интерактивная страница при печати скрыта (print:hidden).
 *  - student: тест без ответов, домашка без критериев проверки;
 *  - mentor: правильные ответы, объяснения и критерии проверки.
 */
export function PrintableMaterials({
  materials,
  variant,
  recordingUrl,
}: {
  materials: Materials;
  variant: PrintVariant;
  recordingUrl?: string | null;
}) {
  const mentor = variant === "mentor";
  const ts = (value?: string) => (value ? <span className="print-ts"> [{value}]</span> : null);

  return (
    <article className="print-doc hidden print:block">
      <header>
        <p className="print-meta">
          Jazba · {mentor ? "версия для ментора (с ответами)" : "материалы занятия"}
        </p>
        <h1>{materials.title}</h1>
        {recordingUrl && <p className="print-meta">Запись: {recordingUrl}</p>}
      </header>

      {materials.summary.length > 0 && (
        <section>
          <h2>Конспект</h2>
          {materials.summary.map((s, i) => (
            <div key={i} className="print-block">
              <h3>
                {i + 1}. {s.heading}
                {ts(s.timestamp)}
              </h3>
              <ul>
                {s.points.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {materials.quiz.length > 0 && (
        <section>
          <h2>Тест</h2>
          {materials.quiz.map((q, i) => (
            <div key={i} className="print-block">
              <p className="print-question">
                {i + 1}. {q.question}
              </p>
              <ol type="A">
                {q.options.map((o, j) => (
                  <li key={j} className={mentor && j === q.correctIndex ? "print-correct" : undefined}>
                    {o}
                    {mentor && j === q.correctIndex && " ✓"}
                  </li>
                ))}
              </ol>
              {mentor && (
                <p className="print-note">
                  Ответ: {String.fromCharCode(65 + q.correctIndex)}. {q.explanation}
                  {ts(q.timestamp)}
                </p>
              )}
            </div>
          ))}
          {!mentor && (
            <p className="print-meta">
              Ответы и объяснения — в онлайн-версии теста по ссылке от ментора.
            </p>
          )}
        </section>
      )}

      <section>
        <h2>Домашнее задание</h2>
        <p>{materials.homework.task}</p>
        {materials.homework.requirements.length > 0 && (
          <>
            <h3>Требования</h3>
            <ol>
              {materials.homework.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
          </>
        )}
        {mentor && materials.homework.criteria.length > 0 && (
          <>
            <h3>Критерии проверки</h3>
            <ul>
              {materials.homework.criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {materials.faq.length > 0 && (
        <section>
          <h2>FAQ</h2>
          {materials.faq.map((f, i) => (
            <div key={i} className="print-block">
              <p className="print-question">
                {f.question}
                {ts(f.timestamp)}
              </p>
              <p>{f.answer}</p>
            </div>
          ))}
        </section>
      )}

      {materials.glossary.length > 0 && (
        <section>
          <h2>Глоссарий</h2>
          <table>
            <thead>
              <tr>
                <th>Термин</th>
                <th>Қазақша</th>
                <th>Русский</th>
                <th>English</th>
                <th>Определение</th>
              </tr>
            </thead>
            <tbody>
              {materials.glossary.map((g, i) => (
                <tr key={i}>
                  <td>{g.term}</td>
                  <td>{g.kk}</td>
                  <td>{g.ru}</td>
                  <td>{g.en}</td>
                  <td>{g.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  );
}

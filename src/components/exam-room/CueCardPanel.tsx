import type { CueCard } from "@/types/exam";

export function CueCardPanel({ card }: { card: CueCard }) {
  return (
    <section aria-label="Part 2 task card" className="w-full max-w-xl rounded-xl bg-slate-50 px-6 py-5 text-slate-900 shadow-lg">
      <h2 className="text-lg font-semibold">{card.topic}</h2>
      <p className="mt-2 text-sm text-slate-600">You should say:</p>
      <ul className="mt-1 list-disc pl-5 text-[15px]">
        {card.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </section>
  );
}

import type { State, Invoice, Enrollment } from './logic';
import { addMonths, monthOf } from './logic';

function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

const courses = [
  { id: 'c1', name: 'Violão popular', hue: '#c8553d', price: 220, hours: 48 },
  { id: 'c2', name: 'Fotografia autoral', hue: '#2f6f62', price: 290, hours: 40 },
  { id: 'c3', name: 'Espanhol conversação', hue: '#d89a1c', price: 260, hours: 60 },
  { id: 'c4', name: 'Cerâmica manual', hue: '#7a5c8e', price: 340, hours: 36 },
  { id: 'c5', name: 'Escrita criativa', hue: '#3d6a9c', price: 190, hours: 32 },
  { id: 'c6', name: 'Excel para o trabalho', hue: '#5b7f3a', price: 240, hours: 24 },
];
const classes = [
  ['k1', 'c1', 'Violão A', 'Seg e Qua', '19:00', 'Rafael Mota', 'Sala 1', 10],
  ['k2', 'c1', 'Violão B', 'Sáb', '09:00', 'Rafael Mota', 'Sala 1', 8],
  ['k3', 'c2', 'Foto — noturna', 'Ter e Qui', '19:30', 'Helena Vaz', 'Ateliê', 12],
  ['k4', 'c3', 'Espanhol I', 'Ter e Qui', '18:30', 'Lucía Benítez', 'Sala 2', 14],
  ['k5', 'c3', 'Espanhol II', 'Seg e Qua', '20:00', 'Lucía Benítez', 'Sala 2', 12],
  ['k6', 'c4', 'Cerâmica — manhã', 'Sáb', '10:00', 'Iara Campos', 'Ateliê', 9],
  ['k7', 'c4', 'Cerâmica — noite', 'Sex', '19:00', 'Iara Campos', 'Ateliê', 9],
  ['k8', 'c5', 'Escrita — quinzenal', 'Qui', '20:00', 'Otávio Reis', 'Sala 3', 15],
  ['k9', 'c6', 'Excel essencial', 'Seg e Qua', '18:30', 'Beatriz Lemos', 'Lab', 16],
  ['k10', 'c6', 'Excel avançado', 'Sáb', '14:00', 'Beatriz Lemos', 'Lab', 16],
].map(([id, courseId, label, day, time, teacher, room, capacity]) => ({ id, courseId, label, day, time, teacher, room, capacity })) as State['classes'];

const first = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isadora', 'João', 'Karina', 'Leonardo', 'Mariana', 'Nicolas', 'Olívia', 'Paulo', 'Raquel', 'Sofia', 'Tiago', 'Vitória', 'Yuri', 'Lívia', 'Caio', 'Débora'];
const last = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Farias', 'Gomes', 'Holanda', 'Ibrahim', 'Jardim', 'Klein', 'Moraes', 'Nogueira', 'Pacheco', 'Queiroz', 'Ramos', 'Siqueira', 'Teixeira'];

export function seed(today: string): State {
  const r = rng(544);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const month = monthOf(today);
  const students = Array.from({ length: 52 }, (_, n) => {
    const name = `${first[n % first.length]} ${pick(last)}`;
    return { id: `a${n + 1}`, name, phone: `(41) 9${String(1000 + Math.floor(r() * 8999))}-${String(1000 + Math.floor(r() * 8999))}`, email: `${name.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(' ', '.')}@exemplo.test`, since: `${addMonths(month, -Math.floor(r() * 14))}-05` };
  });
  const enrollments: Enrollment[] = [];
  const invoices: Invoice[] = [];
  const taken: Record<string, number> = {};
  const lots = new Set(['k3', 'k6']); // turmas lotadas na demo
  students.forEach((st) => {
    const n = r() < 0.4 ? 2 : r() < 0.95 ? 1 : 0;
    const mine = new Set<string>();
    for (let t = 0; t < n; t++) {
      const k = pick(classes);
      const cap = k.capacity;
      if (mine.has(k.id) || (taken[k.id] ?? 0) >= cap) continue;
      mine.add(k.id);
      taken[k.id] = (taken[k.id] ?? 0) + 1;
      const back = Math.min(5, Math.floor(r() * 7));
      const start = `${addMonths(month, -back)}-03`;
      const dueDay = pick([5, 10, 10, 15, 20]);
      const e: Enrollment = { id: `m${enrollments.length + 1}`, studentId: st.id, classId: k.id, start, active: r() > 0.07, dueDay };
      enrollments.push(e);
      const c = courses.find((x) => x.id === k.courseId)!;
      for (let b = back; b >= 0; b--) {
        const m = addMonths(month, -b);
        if (!e.active && b < 1) continue;
        const due = `${m}-${String(dueDay).padStart(2, '0')}`;
        const delinquent = st.id.length % 5 === 0 && b <= 1;
        const paid = !delinquent && (due < today ? r() < (b === 0 ? 0.8 : b === 1 ? 0.95 : 1) : r() < 0.15);
        invoices.push({ id: `i-${e.id}-${m}`, enrollmentId: e.id, studentId: st.id, month: m, due, amount: c.price, paidAt: paid ? (due < today ? due : today) : null, method: paid ? pick(['Pix', 'Pix', 'Cartão', 'Dinheiro']) : null });
      }
    }
  });
  // enche as turmas marcadas como lotadas
  for (const id of lots) {
    const k = classes.find((c) => c.id === id)!;
    const c = courses.find((x) => x.id === k.courseId)!;
    for (const st of students) {
      if ((taken[id] ?? 0) >= k.capacity) break;
      if (enrollments.some((e) => e.studentId === st.id && e.classId === id)) continue;
      const e: Enrollment = { id: `m${enrollments.length + 1}`, studentId: st.id, classId: id, start: `${addMonths(month, -2)}-03`, active: true, dueDay: 10 };
      enrollments.push(e); taken[id] = (taken[id] ?? 0) + 1;
      for (let b = 2; b >= 0; b--) { const m = addMonths(month, -b); const due = `${m}-10`; invoices.push({ id: `i-${e.id}-${m}`, enrollmentId: e.id, studentId: st.id, month: m, due, amount: c.price, paidAt: b > 0 || due >= today ? (due < today ? due : null) : today, method: 'Pix' }); }
    }
  }
  return { courses, classes, students, enrollments, invoices };
}

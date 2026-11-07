export interface Course { id: string; name: string; hue: string; price: number; hours: number }
export interface Klass { id: string; courseId: string; label: string; day: string; time: string; teacher: string; room: string; capacity: number }
export interface Student { id: string; name: string; phone: string; email: string; since: string }
export interface Enrollment { id: string; studentId: string; classId: string; start: string; active: boolean; dueDay: number }
export interface Invoice { id: string; enrollmentId: string; studentId: string; month: string; due: string; amount: number; paidAt: string | null; method: string | null }
export interface State { courses: Course[]; classes: Klass[]; students: Student[]; enrollments: Enrollment[]; invoices: Invoice[] }
export type InvStatus = 'paga' | 'atrasada' | 'aberta';

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const monthOf = (day: string) => day.slice(0, 7);
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  return iso(new Date(y, m - 1 + n, 1)).slice(0, 7);
};
const dueFor = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;

export const statusOf = (i: Invoice, today: string): InvStatus => (i.paidAt ? 'paga' : i.due < today ? 'atrasada' : 'aberta');
export const daysLate = (i: Invoice, today: string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(i.due)) / 864e5));

export const seatsTaken = (s: State, classId: string) => s.enrollments.filter((e) => e.classId === classId && e.active).length;

export function enroll(s: State, studentId: string, classId: string, today: string, dueDay = 10): { ok: true; state: State } | { ok: false; error: string } {
  const k = s.classes.find((c) => c.id === classId);
  const c = k && s.courses.find((x) => x.id === k.courseId);
  if (!k || !c || !s.students.some((x) => x.id === studentId)) return { ok: false, error: 'Aluno ou turma inexistente.' };
  if (s.enrollments.some((e) => e.studentId === studentId && e.classId === classId && e.active)) return { ok: false, error: 'Aluno já matriculado nesta turma.' };
  if (seatsTaken(s, classId) >= k.capacity) return { ok: false, error: 'Turma lotada.' };
  const id = `m${s.enrollments.length + 1}-${Date.now().toString(36)}`;
  const month = monthOf(today);
  const inv: Invoice = { id: `i-${id}-${month}`, enrollmentId: id, studentId, month, due: dueFor(month, dueDay), amount: c.price, paidAt: null, method: null };
  return { ok: true, state: { ...s, enrollments: [...s.enrollments, { id, studentId, classId, start: today, active: true, dueDay }], invoices: [...s.invoices, inv] } };
}

export function cancelEnrollment(s: State, enrollmentId: string, today: string): State {
  const month = monthOf(today);
  return {
    ...s,
    enrollments: s.enrollments.map((e) => (e.id === enrollmentId ? { ...e, active: false } : e)),
    invoices: s.invoices.filter((i) => !(i.enrollmentId === enrollmentId && !i.paidAt && i.month > month)),
  };
}

export const pay = (s: State, invoiceId: string, today: string, method: string): State => ({
  ...s,
  invoices: s.invoices.map((i) => (i.id === invoiceId && !i.paidAt ? { ...i, paidAt: today, method } : i)),
});

/** Gera as mensalidades do mês de `today` para matrículas ativas que ainda não têm. */
export function closeMonth(s: State, today: string): State {
  const month = monthOf(today);
  const add: Invoice[] = [];
  for (const e of s.enrollments) {
    if (!e.active || monthOf(e.start) > month || s.invoices.some((i) => i.enrollmentId === e.id && i.month === month)) continue;
    const k = s.classes.find((c) => c.id === e.classId)!;
    const c = s.courses.find((x) => x.id === k.courseId)!;
    add.push({ id: `i-${e.id}-${month}`, enrollmentId: e.id, studentId: e.studentId, month, due: dueFor(month, e.dueDay), amount: c.price, paidAt: null, method: null });
  }
  return add.length ? { ...s, invoices: [...s.invoices, ...add] } : s;
}

export function summary(s: State, today: string) {
  const month = monthOf(today);
  const active = new Set(s.enrollments.filter((e) => e.active).map((e) => e.studentId));
  const mInv = s.invoices.filter((i) => i.month === month);
  const received = mInv.filter((i) => i.paidAt).reduce((a, i) => a + i.amount, 0);
  const expected = mInv.reduce((a, i) => a + i.amount, 0);
  const late = s.invoices.filter((i) => statusOf(i, today) === 'atrasada');
  const seats = s.classes.reduce((a, k) => a + k.capacity, 0);
  const taken = s.classes.reduce((a, k) => a + seatsTaken(s, k.id), 0);
  const months = Array.from({ length: 6 }, (_, n) => addMonths(month, n - 5));
  const series = months.map((m) => ({ month: m, value: s.invoices.filter((i) => i.month === m && i.paidAt).reduce((a, i) => a + i.amount, 0) }));
  return {
    students: active.size, received, expected, lateCount: late.length, lateTotal: late.reduce((a, i) => a + i.amount, 0),
    occupancy: seats ? taken / seats : 0, series,
    delinquency: expected ? late.reduce((a, i) => a + i.amount, 0) / expected : 0,
  };
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

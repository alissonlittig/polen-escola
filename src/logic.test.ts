import { describe, expect, it } from 'vitest';
import { seed } from './seed';
import { cancelEnrollment, closeMonth, enroll, pay, seatsTaken, statusOf, summary, addMonths } from './logic';

const today = '2026-11-07';
const s0 = seed(today);

describe('mensalidades', () => {
  it('classifica status', () => {
    const base = { id: 'x', enrollmentId: 'e', studentId: 's', month: '2026-11', amount: 1, method: null };
    expect(statusOf({ ...base, due: '2026-11-05', paidAt: null }, today)).toBe('atrasada');
    expect(statusOf({ ...base, due: '2026-11-10', paidAt: null }, today)).toBe('aberta');
    expect(statusOf({ ...base, due: '2026-11-05', paidAt: today }, today)).toBe('paga');
  });
  it('pagar quita uma vez só', () => {
    const late = s0.invoices.find((i) => statusOf(i, today) === 'atrasada')!;
    const s1 = pay(s0, late.id, today, 'Pix');
    expect(s1.invoices.find((i) => i.id === late.id)!.paidAt).toBe(today);
    expect(pay(s1, late.id, '2026-11-08', 'Cartão').invoices.find((i) => i.id === late.id)!.method).toBe('Pix');
    expect(summary(s1, today).lateCount).toBe(summary(s0, today).lateCount - 1);
  });
  it('virada de mês', () => {
    expect(addMonths('2026-01', -2)).toBe('2025-11');
    const next = '2026-12-02';
    const s1 = closeMonth(s0, next);
    expect(s1.invoices.filter((i) => i.month === '2026-12').length).toBe(s0.enrollments.filter((e) => e.active).length);
    expect(closeMonth(s1, next)).toBe(s1);
  });
});

describe('matrículas', () => {
  const full = s0.classes.find((k) => seatsTaken(s0, k.id) >= k.capacity)!;
  const free = s0.classes.find((k) => seatsTaken(s0, k.id) < k.capacity)!;
  it('barra turma lotada', () => {
    expect(enroll(s0, s0.students.find((x) => !s0.enrollments.some((e) => e.studentId === x.id && e.classId === full.id))!.id, full.id, today)).toEqual({ ok: false, error: 'Turma lotada.' });
  });
  it('matricula, gera mensalidade e barra duplicidade', () => {
    const stu = s0.students.find((x) => !s0.enrollments.some((e) => e.studentId === x.id && e.classId === free.id && e.active))!;
    const r = enroll(s0, stu.id, free.id, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(seatsTaken(r.state, free.id)).toBe(seatsTaken(s0, free.id) + 1);
    expect(r.state.invoices.length).toBe(s0.invoices.length + 1);
    expect(enroll(r.state, stu.id, free.id, today).ok).toBe(false);
  });
  it('cancelar libera vaga', () => {
    const e = s0.enrollments.find((x) => x.active)!;
    expect(seatsTaken(cancelEnrollment(s0, e.id, today), e.classId)).toBe(seatsTaken(s0, e.classId) - 1);
  });
});

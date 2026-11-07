import { LitElement, html, nothing, svg } from 'lit';
import { brl, cancelEnrollment, closeMonth, daysLate, enroll, iso, pay, seatsTaken, statusOf, summary, type InvStatus, type State } from './logic';
import { seed } from './seed';

const KEY = 'polen-demo-v1';
const today = iso(new Date());
const TABS = [
  ['painel', 'Painel', 'M3 13h7V3H3zm0 8h7v-6H3zm11 0h7V11h-7zm0-18v6h7V3z'],
  ['alunos', 'Alunos', 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z'],
  ['turmas', 'Turmas', 'M4 5h16v4H4zm0 6h10v4H4zm0 6h16v2H4z'],
  ['mensalidades', 'Mensalidades', 'M3 6h18v12H3zm2 2v2h14V8zm0 4v4h14v-4zm2 1h4v2H7z'],
] as const;
type Tab = (typeof TABS)[number][0];
type Modal =
  | { t: 'aluno'; id: string }
  | { t: 'novo-aluno' }
  | { t: 'matricular'; studentId?: string; classId?: string }
  | { t: 'receber'; id: string }
  | null;

const ic = (d: string) => html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
const initials = (n: string) => n.split(' ').map((p) => p[0]).slice(0, 2).join('');
const dm = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7);
const monthName = (m: string) => new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
const BADGE: Record<InvStatus, string> = { paga: 'Paga', atrasada: 'Atrasada', aberta: 'Em aberto' };

class PolenApp extends LitElement {
  static properties = { s: { state: true }, tab: { state: true }, modal: { state: true }, filter: { state: true }, q: { state: true }, toast: { state: true }, err: { state: true } };
  declare s: State; declare tab: Tab; declare modal: Modal; declare filter: InvStatus | 'todas'; declare q: string; declare toast: string; declare err: string;
  private timer = 0;

  constructor() {
    super();
    let st: State | null = null;
    try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { st = null; }
    this.s = closeMonth(st && st.students ? st : seed(today), today);
    this.tab = 'painel'; this.modal = null; this.filter = 'atrasada'; this.q = ''; this.toast = ''; this.err = '';
    this.save(this.s);
  }
  createRenderRoot() { return this; }
  private save(s: State) { this.s = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage cheio: segue só em memória */ } }
  private say(msg: string) { this.toast = msg; clearTimeout(this.timer); this.timer = window.setTimeout(() => (this.toast = ''), 2800); }
  private open(m: Modal) { this.err = ''; this.modal = m; }
  private go(t: Tab) { this.tab = t; this.modal = null; window.scrollTo(0, 0); }

  private stu(id: string) { return this.s.students.find((x) => x.id === id)!; }
  private klass(id: string) { return this.s.classes.find((x) => x.id === id)!; }
  private course(id: string) { return this.s.courses.find((x) => x.id === id)!; }
  private invOf(studentId: string) { return this.s.invoices.filter((i) => i.studentId === studentId).sort((a, b) => b.due.localeCompare(a.due)); }
  private lateOf(studentId: string) { return this.s.invoices.filter((i) => i.studentId === studentId && statusOf(i, today) === 'atrasada'); }

  private charge(invId: string) {
    const i = this.s.invoices.find((x) => x.id === invId)!;
    const msg = `Olá, ${this.stu(i.studentId).name.split(' ')[0]}! Passando para lembrar da mensalidade de ${this.course(this.klass(this.s.enrollments.find((e) => e.id === i.enrollmentId)!.classId).courseId).name} (${brl(i.amount)}, venc. ${dm(i.due)}). Se já pagou, desconsidere. Obrigada! — Pólen`;
    navigator.clipboard?.writeText(msg).catch(() => {});
    this.say('Mensagem de cobrança copiada (demo: nada é enviado).');
  }

  render() {
    return html`
      <div class="shell">
        <aside class="side">
          <div class="brand"><span class="dot"></span><b>Pólen</b><small>cursos livres</small></div>
          <nav aria-label="Seções">${TABS.map(([k, l, d]) => html`<button class=${this.tab === k ? 'on' : ''} aria-current=${this.tab === k ? 'page' : 'false'} @click=${() => this.go(k)}>${ic(d)}<span>${l}</span></button>`)}</nav>
          <div class="side-foot">
            <p>Demonstração com dados fictícios, salvos só neste navegador.</p>
            <button class="ghost" @click=${() => { if (confirm('Restaurar os dados de exemplo?')) { this.save(closeMonth(seed(today), today)); this.say('Dados de exemplo restaurados.'); } }}>Restaurar exemplo</button>
          </div>
        </aside>
        <main>
          <header class="top">
            <div><p class="eyebrow">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${TABS.find((t) => t[0] === this.tab)![1]}</h1></div>
            <div class="top-actions">
              <button class="btn ghost" @click=${() => this.open({ t: 'novo-aluno' })}>Novo aluno</button>
              <button class="btn" @click=${() => this.open({ t: 'matricular' })}>Nova matrícula</button>
            </div>
          </header>
          <div class="demo-note">Dados fictícios · projeto de demonstração</div>
          ${this.tab === 'painel' ? this.vPainel() : this.tab === 'alunos' ? this.vAlunos() : this.tab === 'turmas' ? this.vTurmas() : this.vMens()}
        </main>
        <nav class="tabbar" aria-label="Seções">${TABS.map(([k, l, d]) => html`<button class=${this.tab === k ? 'on' : ''} @click=${() => this.go(k)}>${ic(d)}<span>${l === 'Mensalidades' ? 'Mensal.' : l}</span></button>`)}</nav>
      </div>
      ${this.vModal()}
      <div class="toast" role="status" aria-live="polite">${this.toast}</div>`;
  }

  private vPainel() {
    const m = summary(this.s, today);
    const max = Math.max(1, ...m.series.map((x) => x.value));
    const lates = this.s.invoices.filter((i) => statusOf(i, today) === 'atrasada').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    return html`
      <section class="kpis">
        <article class="kpi"><span>Alunos ativos</span><b>${m.students}</b><em>${this.s.enrollments.filter((e) => e.active).length} matrículas</em></article>
        <article class="kpi"><span>Recebido no mês</span><b>${brl(m.received)}</b><em>de ${brl(m.expected)} previstos</em></article>
        <article class="kpi warn"><span>Em atraso</span><b>${brl(m.lateTotal)}</b><em>${m.lateCount} mensalidades · ${(m.delinquency * 100).toFixed(0)}% do mês</em></article>
        <article class="kpi"><span>Ocupação das turmas</span><b>${Math.round(m.occupancy * 100)}%</b><em>${this.s.classes.length} turmas abertas</em></article>
      </section>
      <section class="grid2">
        <article class="card">
          <h2>Recebimentos · últimos 6 meses</h2>
          <svg class="chart" viewBox="0 0 360 170" role="img" aria-label="Gráfico de barras com o recebido por mês">
            ${m.series.map((p, n) => { const h = (p.value / max) * 120; const x = 12 + n * 58; return svg`<rect x=${x} y=${140 - h} width="40" height=${h} rx="6" class=${n === 5 ? 'bar now' : 'bar'}/><text x=${x + 20} y="158" text-anchor="middle">${monthName(p.month)}</text><text x=${x + 20} y=${134 - h} text-anchor="middle" class="val">${p.value >= 1000 ? (p.value / 1000).toFixed(1).replace('.', ',') + 'k' : p.value}</text>`; })}
          </svg>
        </article>
        <article class="card">
          <div class="card-h"><h2>Para cobrar hoje</h2><button class="link" @click=${() => { this.filter = 'atrasada'; this.go('mensalidades'); }}>ver todas</button></div>
          ${lates.length ? html`<ul class="list">${lates.map((i) => html`<li class="row"><div class="avatar">${initials(this.stu(i.studentId).name)}</div><div class="grow"><b>${this.stu(i.studentId).name}</b><small>${daysLate(i, today)} dias · ${brl(i.amount)}</small></div><button class="btn sm ghost" @click=${() => this.charge(i.id)}>Cobrar</button></li>`)}</ul>` : html`<p class="empty">Nenhuma mensalidade atrasada.</p>`}
        </article>
        <article class="card wide">
          <h2>Ocupação por turma</h2>
          <ul class="occ">${this.s.classes.map((k) => { const n = seatsTaken(this.s, k.id); const p = n / k.capacity; return html`<li><span class="sw" style="background:${this.course(k.courseId).hue}"></span><div class="grow"><b>${k.label}</b><small>${k.day} · ${k.time}</small></div><div class="meter" aria-hidden="true"><i style="width:${p * 100}%"></i></div><span class="num ${p >= 1 ? 'full' : ''}">${p >= 1 ? 'Lotada' : `${k.capacity - n} vagas`}</span></li>`; })}</ul>
        </article>
      </section>`;
  }

  private vAlunos() {
    const q = this.q.trim().toLowerCase();
    const list = this.s.students.filter((x) => !q || x.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    return html`
      <div class="bar"><input type="search" placeholder="Buscar aluno pelo nome" aria-label="Buscar aluno" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)}><span class="count">${list.length} alunos</span></div>
      <ul class="list card flush">${list.length ? list.map((x) => {
        const mine = this.s.enrollments.filter((e) => e.studentId === x.id && e.active);
        const late = this.lateOf(x.id).length;
        return html`<li><button class="row full" @click=${() => this.open({ t: 'aluno', id: x.id })}><div class="avatar">${initials(x.name)}</div><div class="grow"><b>${x.name}</b><small>${mine.length ? mine.map((e) => this.course(this.klass(e.classId).courseId).name).join(' · ') : 'Sem matrícula ativa'}</small></div>${late ? html`<span class="badge atrasada">${late} atrasada${late > 1 ? 's' : ''}</span>` : mine.length ? html`<span class="badge paga">Em dia</span>` : html`<span class="badge">Inativo</span>`}</button></li>`;
      }) : html`<li class="empty">Nenhum aluno encontrado.</li>`}</ul>`;
  }

  private vTurmas() {
    return html`<section class="turmas">${this.s.classes.map((k) => {
      const c = this.course(k.courseId); const n = seatsTaken(this.s, k.id); const full = n >= k.capacity;
      const roster = this.s.enrollments.filter((e) => e.classId === k.id && e.active);
      return html`<article class="card turma" style="--hue:${c.hue}">
        <p class="eyebrow">${c.name}</p><h2>${k.label}</h2>
        <dl><div><dt>Quando</dt><dd>${k.day}, ${k.time}</dd></div><div><dt>Professor(a)</dt><dd>${k.teacher}</dd></div><div><dt>Sala</dt><dd>${k.room}</dd></div><div><dt>Mensalidade</dt><dd>${brl(c.price)}</dd></div></dl>
        <div class="meter"><i style="width:${(n / k.capacity) * 100}%"></i></div>
        <p class="seats">${n} de ${k.capacity} vagas ocupadas ${full ? html`<b class="full">· lotada</b>` : nothing}</p>
        <div class="chips">${roster.slice(0, 6).map((e) => html`<button class="chip" @click=${() => this.open({ t: 'aluno', id: e.studentId })}>${this.stu(e.studentId).name.split(' ')[0]}</button>`)}${roster.length > 6 ? html`<span class="chip mute">+${roster.length - 6}</span>` : nothing}</div>
        <button class="btn sm ${full ? 'ghost' : ''}" ?disabled=${full} @click=${() => this.open({ t: 'matricular', classId: k.id })}>${full ? 'Sem vagas' : 'Matricular aluno'}</button>
      </article>`;
    })}</section>`;
  }

  private vMens() {
    const all = this.s.invoices;
    const cnt = (f: InvStatus) => all.filter((i) => statusOf(i, today) === f && (f !== 'paga' || i.month === today.slice(0, 7))).length;
    const rows = all.filter((i) => (this.filter === 'todas' ? i.month === today.slice(0, 7) || !i.paidAt : statusOf(i, today) === this.filter && (this.filter !== 'paga' || i.month === today.slice(0, 7))))
      .sort((a, b) => a.due.localeCompare(b.due)).slice(0, 60);
    const chips: [InvStatus | 'todas', string, number | string][] = [['atrasada', 'Atrasadas', cnt('atrasada')], ['aberta', 'Em aberto', cnt('aberta')], ['paga', 'Pagas no mês', cnt('paga')], ['todas', 'Do mês + pendentes', '']];
    return html`
      <div class="seg" role="tablist">${chips.map(([k, l, n]) => html`<button role="tab" aria-selected=${this.filter === k} class=${this.filter === k ? 'on' : ''} @click=${() => (this.filter = k)}>${l}${n !== '' ? html` <i>${n}</i>` : nothing}</button>`)}</div>
      <ul class="list card flush">${rows.length ? rows.map((i) => {
        const st = statusOf(i, today); const e = this.s.enrollments.find((x) => x.id === i.enrollmentId)!;
        return html`<li class="row"><div class="avatar">${initials(this.stu(i.studentId).name)}</div>
          <div class="grow"><b>${this.stu(i.studentId).name}</b><small>${this.course(this.klass(e.classId).courseId).name} · venc. ${dm(i.due)}${st === 'atrasada' ? ` · ${daysLate(i, today)} dias` : ''}${i.paidAt ? ` · ${i.method}` : ''}</small></div>
          <span class="money">${brl(i.amount)}</span><span class="badge ${st}">${BADGE[st]}</span>
          <div class="acts">${st === 'paga' ? nothing : html`${st === 'atrasada' ? html`<button class="btn sm ghost" @click=${() => this.charge(i.id)}>Cobrar</button>` : nothing}<button class="btn sm" @click=${() => this.open({ t: 'receber', id: i.id })}>Receber</button>`}</div></li>`;
      }) : html`<li class="empty">Nada por aqui.</li>`}</ul>`;
  }

  private vModal() {
    const m = this.modal; if (!m) return nothing;
    const close = () => (this.modal = null);
    let title = ''; let body = html``;
    if (m.t === 'novo-aluno') {
      title = 'Novo aluno';
      body = html`<form @submit=${(e: SubmitEvent) => { e.preventDefault(); const f = new FormData(e.target as HTMLFormElement); const name = String(f.get('name')).trim(); if (name.length < 3) { this.err = 'Informe o nome completo.'; return; } const id = 'a' + Date.now().toString(36); this.save({ ...this.s, students: [...this.s.students, { id, name, phone: String(f.get('phone')), email: String(f.get('email')), since: today }] }); this.say('Aluno cadastrado.'); this.open({ t: 'matricular', studentId: id }); }}>
        <label>Nome completo<input name="name" required autocomplete="off"></label>
        <label>Telefone<input name="phone" inputmode="tel" placeholder="(41) 90000-0000"></label>
        <label>E-mail<input name="email" type="email" placeholder="nome@exemplo.test"></label>
        ${this.err ? html`<p class="err">${this.err}</p>` : nothing}
        <div class="foot"><button type="button" class="btn ghost" @click=${close}>Cancelar</button><button class="btn">Cadastrar e matricular</button></div></form>`;
    } else if (m.t === 'matricular') {
      title = 'Nova matrícula';
      body = html`<form @submit=${(e: SubmitEvent) => { e.preventDefault(); const f = new FormData(e.target as HTMLFormElement); const r = enroll(this.s, String(f.get('s')), String(f.get('k')), today, Number(f.get('d'))); if (!r.ok) { this.err = r.error; return; } this.save(r.state); this.say('Matrícula criada e mensalidade gerada.'); close(); }}>
        <label>Aluno<select name="s" required>${[...this.s.students].sort((a, b) => a.name.localeCompare(b.name)).map((x) => html`<option value=${x.id} ?selected=${x.id === m.studentId}>${x.name}</option>`)}</select></label>
        <label>Turma<select name="k" required>${this.s.classes.map((k) => { const full = seatsTaken(this.s, k.id) >= k.capacity; return html`<option value=${k.id} ?disabled=${full} ?selected=${k.id === m.classId}>${k.label} · ${k.day} ${k.time}${full ? ' (lotada)' : ''}</option>`; })}</select></label>
        <label>Vencimento (dia)<select name="d">${[5, 10, 15, 20].map((d) => html`<option ?selected=${d === 10}>${d}</option>`)}</select></label>
        ${this.err ? html`<p class="err">${this.err}</p>` : nothing}
        <div class="foot"><button type="button" class="btn ghost" @click=${close}>Cancelar</button><button class="btn">Matricular</button></div></form>`;
    } else if (m.t === 'receber') {
      const i = this.s.invoices.find((x) => x.id === m.id)!; title = 'Receber mensalidade';
      body = html`<p class="lead">${this.stu(i.studentId).name} · <b>${brl(i.amount)}</b> · venc. ${dm(i.due)}</p>
        <div class="methods">${['Pix', 'Cartão', 'Dinheiro'].map((x) => html`<button class="btn ghost" @click=${() => { this.save(pay(this.s, i.id, today, x)); this.say(`Recebido via ${x}.`); close(); }}>${x}</button>`)}</div>`;
    } else {
      const x = this.stu(m.id); title = x.name;
      const mine = this.s.enrollments.filter((e) => e.studentId === x.id && e.active);
      body = html`<p class="lead">${x.phone || 'sem telefone'} · ${x.email || 'sem e-mail'}<br>Aluno desde ${dm(x.since)}/${x.since.slice(0, 4)}</p>
        <h3>Matrículas</h3>
        ${mine.length ? html`<ul class="list">${mine.map((e) => { const k = this.klass(e.classId); return html`<li class="row"><span class="sw" style="background:${this.course(k.courseId).hue}"></span><div class="grow"><b>${k.label}</b><small>${k.day} · ${k.time}</small></div><button class="btn sm ghost" @click=${() => { if (confirm('Cancelar esta matrícula?')) { this.save(cancelEnrollment(this.s, e.id, today)); this.say('Matrícula cancelada.'); } }}>Cancelar</button></li>`; })}</ul>` : html`<p class="empty">Sem matrícula ativa.</p>`}
        <button class="btn sm" @click=${() => this.open({ t: 'matricular', studentId: x.id })}>Matricular em turma</button>
        <h3>Mensalidades</h3>
        <ul class="list">${this.invOf(x.id).slice(0, 8).map((i) => { const st = statusOf(i, today); return html`<li class="row"><div class="grow"><b>${brl(i.amount)}</b><small>venc. ${dm(i.due)}${i.paidAt ? ` · pago ${dm(i.paidAt)}` : ''}</small></div><span class="badge ${st}">${BADGE[st]}</span>${st === 'paga' ? nothing : html`<button class="btn sm" @click=${() => this.open({ t: 'receber', id: i.id })}>Receber</button>`}</li>`; })}</ul>`;
    }
    return html`<div class="scrim" @click=${(e: Event) => e.target === e.currentTarget && close()} @keydown=${(e: KeyboardEvent) => e.key === 'Escape' && close()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}><header><h2>${title}</h2><button class="x" aria-label="Fechar" @click=${close}>×</button></header>${body}</div></div>`;
  }

  updated() { if (this.modal) { const f = this.querySelector<HTMLElement>('.sheet input, .sheet select, .sheet .btn'); if (f && !this.querySelector('.sheet :focus')) f.focus(); } }
}
customElements.define('polen-app', PolenApp);

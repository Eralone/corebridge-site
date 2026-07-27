// Robokassa payment widget — placeholder. Real integration TBD.
// Usage:
//   data-robokassa data-rk-plan="Бизнес" data-rk-amount="2490" data-rk-period="мес"
// Or programmatically: window.CBRobokassa.open({plan:'Бизнес', amount:2490, period:'мес'});

(function(){
  let bd;
  function ensure(){
    if(bd) return bd;
    bd = document.createElement('div');
    bd.className = 'rk-bd';
    bd.innerHTML = `
      <div class="rk-modal" role="dialog" aria-modal="true" aria-labelledby="rk-title">
        <button class="rk-x" aria-label="Закрыть">×</button>
        <div class="rk-head">
          <div class="rk-brand">
            <span class="rk-logo">R</span>
            <div>
              <div class="rk-brand-name">Robokassa</div>
              <div class="rk-brand-sub">Защищённая оплата</div>
            </div>
          </div>
          <div class="rk-secure">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z"/></svg>
            SSL · 3-D Secure
          </div>
        </div>

        <h3 class="rk-title" id="rk-title">Оплата подписки</h3>
        <div class="rk-summary">
          <div class="rk-summary-row"><span>Тариф</span><b data-rk-plan>—</b></div>
          <div class="rk-summary-row"><span>Период</span><b data-rk-period>—</b></div>
          <div class="rk-summary-row rk-summary-total"><span>К оплате</span><b data-rk-amount>—</b></div>
        </div>

        <div class="rk-methods">
          <div class="rk-method-title">Способ оплаты</div>
          <div class="rk-method-grid">
            <button class="rk-method active"><span>Карта</span></button>
            <button class="rk-method"><span>СБП</span></button>
            <button class="rk-method"><span>SberPay</span></button>
            <button class="rk-method"><span>Кошелёк</span></button>
          </div>
        </div>

        <div class="rk-placeholder">
          <div class="rk-ph-bar">
            <div class="rk-ph-block" style="width:100%"></div>
          </div>
          <div class="rk-ph-bar"><div class="rk-ph-block" style="width:60%"></div><div class="rk-ph-block" style="width:36%"></div></div>
          <div class="rk-ph-bar"><div class="rk-ph-block" style="width:100%"></div></div>
          <div class="rk-ph-note">Здесь откроется форма Robokassa. Сейчас это превью — реальная оплата будет подключена позже.</div>
        </div>

        <button class="rk-pay" disabled>Оплатить через Robokassa</button>
        <div class="rk-legal">Нажимая «Оплатить», вы соглашаетесь с <a href="oferta.html">офертой</a>, <a href="terms.html">условиями использования</a> и <a href="privacy.html">политикой конфиденциальности</a>.</div>
      </div>`;
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target === bd) close(); });
    bd.querySelector('.rk-x').addEventListener('click', close);
    bd.querySelectorAll('.rk-method').forEach(b => b.addEventListener('click', () => {
      bd.querySelectorAll('.rk-method').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    }));
    return bd;
  }

  function fmt(n){ return Number(n).toLocaleString('ru-RU'); }

  function open(opts){
    ensure();
    const plan = opts.plan || 'Подписка';
    const period = opts.period || 'месяц';
    const amount = opts.amount;
    bd.querySelector('[data-rk-plan]').textContent = plan;
    bd.querySelector('[data-rk-period]').textContent = period;
    bd.querySelector('[data-rk-amount]').textContent = (amount === 0 || amount) ? `${fmt(amount)} ₽` : 'По запросу';
    document.body.style.overflow = 'hidden';
    bd.classList.add('open');
  }
  function close(){
    if(bd){ bd.classList.remove('open'); document.body.style.overflow = ''; }
  }

  // Click delegation
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-robokassa]');
    if(!el) return;
    e.preventDefault();
    open({
      plan: el.dataset.rkPlan,
      amount: el.dataset.rkAmount,
      period: el.dataset.rkPeriod || 'месяц'
    });
  });

  // ESC closes
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && bd && bd.classList.contains('open')) close();
  });

  window.CBRobokassa = { open, close };
})();

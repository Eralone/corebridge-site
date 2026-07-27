// Простые попапы-заглушки для кнопок без целевой страницы
window.CBPopup = (function(){
  let bd;
  function ensure(){
    if(bd) return bd;
    bd = document.createElement('div');
    bd.className = 'cb-modal-bd';
    bd.innerHTML = `<div class="cb-modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Закрыть">×</button>
      <h3 data-title></h3>
      <div data-body></div>
      <div class="row gap-12 mt-20" data-actions></div>
    </div>`;
    document.body.appendChild(bd);
    bd.addEventListener('click', e => { if(e.target===bd) close(); });
    bd.querySelector('.x').addEventListener('click', close);
    return bd;
  }
  function open(opts){
    ensure();
    bd.querySelector('[data-title]').textContent = opts.title || '';
    bd.querySelector('[data-body]').innerHTML = opts.body || '';
    const act = bd.querySelector('[data-actions]');
    act.innerHTML = '';
    (opts.actions || [{label:'Понятно', primary:true}]).forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.primary ? 'btn-primary' : 'btn-outline');
      b.textContent = a.label;
      b.onclick = () => { if(a.href){ location.href = a.href; } else { close(); } };
      act.appendChild(b);
    });
    bd.classList.add('open');
  }
  function close(){ if(bd) bd.classList.remove('open'); }
  // Делегирование для data-popup
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-popup]');
    if(!el) return;
    e.preventDefault();
    const d = el.dataset;
    open({
      title: d.popupTitle || el.textContent.trim(),
      body: d.popupBody ? `<p>${d.popupBody}</p>` : '<p>Раздел в разработке. Скоро будет доступен.</p>',
      actions: d.popupAction ? [{label: d.popupAction, primary:true, href: d.popupHref}] : null
    });
  });
  return { open, close };
})();

2:I[8507,["6933","static/chunks/6933-dbbbe43f7b1fed9a.js","7155","static/chunks/app/(site)/(public)/terms/page-a233e6fd04383b0d.js"],"PublicHeader"]
4:I[4707,[],""]
5:I[6423,[],""]
3:T68e1,<div class="legal-hero">
    <span class="legal-tag tag-green">Условия использования</span>
    <h1 class="legal-title">Правила работы с платформой<span>.</span></h1>
    <p class="legal-subtitle">Настоящий документ определяет правила использования сервиса CoreBridge, права на интеллектуальную собственность, ограничения и порядок блокировки учётных записей.</p>
    <div class="legal-meta">
      <div class="legal-meta-item"><b>Сайт:</b>&nbsp;corebridge.ru</div>
      <div class="legal-meta-item"><b>Редакция:</b>&nbsp;05.05.2026</div>
      <div class="legal-meta-item"><b>Вступает в силу:</b>&nbsp;с момента регистрации</div>
    </div>
  </div>

  <div class="legal-toc">
    <div class="legal-toc-title">Содержание</div>
    <ol>
      <li><a href="#s1">О документе и его применении</a></li>
      <li><a href="#s2">Описание сервиса</a></li>
      <li><a href="#s3">Учётная запись и доступ</a></li>
      <li><a href="#s4">Разрешённое использование</a></li>
      <li><a href="#s5">Запрещённые действия</a></li>
      <li><a href="#s6">Интеллектуальная собственность</a></li>
      <li><a href="#s7">Тарифы и лицензии</a></li>
      <li><a href="#s8">Приостановка и блокировка</a></li>
      <li><a href="#s9">Ограничение ответственности</a></li>
      <li><a href="#s10">Связанные документы</a></li>
      <li><a href="#s11">Изменения условий</a></li>
      <li><a href="#s12">Контакты</a></li>
    </ol>
  </div>

  <section class="legal-section" id="s1">
    <div class="legal-section-head"><div class="legal-section-num">01</div><h2>О документе и его применении</h2></div>
    <div class="legal-section-body">
      <p>Настоящие Условия использования (далее — «Условия») регулируют порядок доступа и использования платформы CoreBridge, включая сайт corebridge.ru, Личный кабинет, файл-обработчик .epf и API-сервисы (далее совместно — «Сервис», «Платформа»).</p>
      <p>Оператором Платформы является <strong>ИП Королёв Дмитрий Павлович</strong> (ИНН 120704119287, ОГРНИП 314121813300025), далее — «Исполнитель».</p>
      <div class="legal-callout callout-info">
        <strong>Акцепт условий</strong>
        Регистрируясь в Личном кабинете, скачивая файл .epf или иным образом используя Платформу, вы подтверждаете, что ознакомились с настоящими Условиями и принимаете их в полном объёме. Если вы не согласны — пожалуйста, прекратите использование Сервиса.
      </div>
      <p>Настоящие Условия действуют совместно с <a href="/oferta">Договором-офертой</a> и <a href="/privacy">Политикой конфиденциальности</a>. В случае противоречий между документами приоритет имеет Договор-оферта.</p>
    </div>
  </section>

  <section class="legal-section" id="s2">
    <div class="legal-section-head"><div class="legal-section-num">02</div><h2>Описание сервиса</h2></div>
    <div class="legal-section-body">
      <p>CoreBridge — платформа для интеграции учётных систем 1С с внешними сервисами: маркетплейсами (Ozon, Wildberries, Яндекс Маркет), CRM-системами (Битрикс24, AmoCRM), службами доставки (СДЭК, Почта России), платёжными шлюзами и аналитическими системами.</p>
      <div class="legal-sub">
        <div class="legal-sub-title">Ключевые компоненты Платформы</div>
        <ul class="legal-list">
          <li><strong>Файл .epf</strong> — клиентский модуль, устанавливаемый в 1С. Единственное программное обеспечение на стороне клиента. Инициирует исходящие HTTPS-соединения с нашим сервером.</li>
          <li><strong>Личный кабинет (ЛК)</strong> — веб-интерфейс для управления подпиской, интеграциями, доступами к внешним сервисам и просмотра логов.</li>
          <li><strong>API Gateway</strong> — серверный компонент, обеспечивающий маршрутизацию данных между 1С и внешними сервисами.</li>
          <li><strong>Воркфлоу-движок (n8n)</strong> — система автоматизации, доступная на тарифах «Профессионал» и «Энтерпрайз».</li>
        </ul>
      </div>
      <div class="legal-callout">
        <strong>Архитектурный принцип</strong>
        Данные из базы 1С (документы, справочники, остатки) физически не покидают инфраструктуру клиента в виде «сырой базы». Сервис оперирует только структурированными данными в формате JSON, необходимыми для конкретной интеграции.
      </div>
    </div>
  </section>

  <section class="legal-section" id="s3">
    <div class="legal-section-head"><div class="legal-section-num">03</div><h2>Учётная запись и доступ</h2></div>
    <div class="legal-section-body">
      <div class="legal-sub">
        <div class="legal-sub-title">3.1. Регистрация</div>
        <ul class="legal-list">
          <li>Для использования Платформы необходима регистрация учётной записи с указанием действующего адреса электронной почты.</li>
          <li>Пользователь обязан предоставить достоверные сведения при регистрации и поддерживать их актуальность.</li>
          <li>Одна учётная запись соответствует одному юридическому лицу или ИП. Допускается добавление нескольких пользователей в рамках одной организации согласно условиям тарифа.</li>
          <li>Регистрация несовершеннолетних (до 18 лет) не допускается.</li>
        </ul>
      </div>
      <div class="legal-sub">
        <div class="legal-sub-title">3.2. Безопасность учётной записи</div>
        <ul class="legal-list">
          <li>Пользователь несёт ответственность за сохранность логина, пароля и JWT-токена доступа.</li>
          <li>При подозрении на несанкционированный доступ пользователь обязан незамедлительно уведомить нас по адресу <a href="mailto:info@corebridge.ru">info@corebridge.ru</a> и сменить учётные данные.</li>
          <li>Исполнитель не несёт ответственности за ущерб, причинённый вследствие несанкционированного использования учётной записи по вине пользователя.</li>
        </ul>
      </div>
      <div class="legal-sub">
        <div class="legal-sub-title">3.3. Пробный период</div>
        <p>Новым пользователям предоставляется бессрочный бесплатный пробный тариф, ограниченный: 1 интеграцией, 500 операциями в месяц и 1 пользователем. Пробный тариф не имеет срока действия. Для снятия ограничений необходимо перейти на платный тариф.</p>
      </div>
    </div>
  </section>

  <section class="legal-section" id="s4">
    <div class="legal-section-head"><div class="legal-section-num">04</div><h2>Разрешённое использование</h2></div>
    <div class="legal-section-body">
      <p>Платформа предоставляется исключительно для следующих целей:</p>
      <ul class="legal-list">
        <li>Автоматизация обмена данными между учётной системой 1С пользователя и внешними сервисами в рамках хозяйственной деятельности пользователя;</li>
        <li>Управление интеграциями через Личный кабинет;</li>
        <li>Настройка воркфлоу в системе n8n (для соответствующих тарифов);</li>
        <li>Получение технической поддержки и документации;</li>
        <li>Тестирование возможностей Платформы в рамках пробного периода.</li>
      </ul>
      <p>Использование Платформы в интересах третьих лиц (реселлинг, предоставление субдоступа) допускается только на основании отдельного письменного соглашения с Исполнителем.</p>
    </div>
  </section>

  <section class="legal-section" id="s5">
    <div class="legal-section-head"><div class="legal-section-num">05</div><h2>Запрещённые действия</h2></div>
    <div class="legal-section-body">
      <p>При использовании Платформы строго запрещается:</p>
      <div class="legal-prohib">
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Попытки обойти систему лицензирования, аутентификации или ограничения тарифа</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Декомпиляция, реверс-инжиниринг или модификация файла .epf и серверного программного обеспечения</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Передача, продажа или сублицензирование доступа к Платформе третьим лицам без письменного разрешения Исполнителя</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Создание избыточной нагрузки на серверную инфраструктуру, превышающей установленные лимиты тарифа</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Сбор данных о других пользователях Платформы, несанкционированный доступ к их учётным записям</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Использование Платформы для передачи незаконного, вредоносного или нарушающего права третьих лиц контента</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Автоматизированный парсинг интерфейсов Личного кабинета и API сверх задокументированных возможностей</div></div>
        <div class="legal-prohib-item"><div class="legal-prohib-icon">!</div><div class="legal-prohib-text">Копирование, воспроизведение или распространение материалов Платформы (документации, шаблонов, дизайна) в коммерческих целях</div></div>
      </div>
      <div class="legal-callout callout-warn">
        <strong>Последствия нарушений</strong>
        Выявление запрещённых действий является основанием для немедленной блокировки учётной записи без возврата средств за оплаченный период и, при необходимости, для обращения в правоохранительные органы.
      </div>
    </div>
  </section>

  <section class="legal-section" id="s6">
    <div class="legal-section-head"><div class="legal-section-num">06</div><h2>Интеллектуальная собственность</h2></div>
    <div class="legal-section-body">
      <div class="legal-sub">
        <div class="legal-sub-title">6.1. Права Исполнителя</div>
        <p>Платформа CoreBridge, включая файл .epf, серверное программное обеспечение, API, дизайн Личного кабинета, документацию, шаблоны воркфлоу и товарные знаки, является исключительной интеллектуальной собственностью Исполнителя и охраняется законодательством РФ об авторском праве и смежных правах.</p>
        <p>Предоставление доступа к Платформе не означает передачи каких-либо исключительных прав пользователю.</p>
      </div>
      <div class="legal-sub">
        <div class="legal-sub-title">6.2. Лицензия пользователю</div>
        <p>В рамках оплаченной подписки Исполнитель предоставляет пользователю ограниченную, неисключительную, непередаваемую лицензию на использование Платформы в объёме, предусмотренном выбранным тарифом, исключительно в целях, указанных в разделе 4 настоящих Условий.</p>
      </div>
      <div class="legal-sub">
        <div class="legal-sub-title">6.3. Данные пользователя</div>
        <p>Исполнитель не претендует на права собственности в отношении данных, которые пользователь передаёт через Платформу в ходе интеграции. Пользователь несёт полную ответственность за законность передаваемых данных и наличие необходимых прав на их обработку.</p>
      </div>
    </div>
  </section>

  <section class="legal-section" id="s7">
    <div class="legal-section-head"><div class="legal-section-num">07</div><h2>Тарифы и лицензии</h2></div>
    <div class="legal-section-body">
      <p>Доступ к Платформе предоставляется на основе подписки. Актуальные тарифы и их параметры публикуются на странице <a href="/pricing">corebridge.ru/pricing</a>. Ниже приведены общие принципы тарификации:</p>

      <table class="legal-table">
        <thead><tr><th>Параметр</th><th>Описание</th></tr></thead>
        <tbody>
          <tr><td>Период подписки</td><td>Ежемесячно или ежегодно. Подписка активируется с момента оплаты.</td></tr>
          <tr><td>Лимиты тарифа</td><td>Количество интеграций, пользователей, операций в месяц и выполнений воркфлоу в месяц определяются тарифом и зафиксированы в JWT-токене.</td></tr>
          <tr><td>Превышение лимитов</td><td>При достижении лимита Исполнитель направляет уведомление на email и, при подключении, в Telegram. Обработка операций при этом не приостанавливается.</td></tr>
          <tr><td>Пробный период</td><td>Бессрочно и бесплатно для новых пользователей. Ограничение: 1 интеграция, 500 операций в месяц, 1 пользователь.</td></tr>
          <tr><td>Истечение подписки</td><td>За 7 дней до истечения — уведомление в .epf и на email. После истечения доступ блокируется, данные сохраняются 30 дней.</td></tr>
          <tr><td>Возврат средств</td><td>Осуществляется в соответствии с Договором-офертой и действующим законодательством РФ.</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="legal-section" id="s8">
    <div class="legal-section-head"><div class="legal-section-num">08</div><h2>Приостановка и блокировка</h2></div>
    <div class="legal-section-body">
      <div class="legal-sub">
        <div class="legal-sub-title">8.1. Основания для приостановки (временная)</div>
        <ul class="legal-list">
          <li>Истечение оплаченного периода подписки — доступ восстанавливается автоматически после оплаты;</li>
          <li>Технические работы по обслуживанию и обновлению Платформы — с предварительным уведомлением;</li>
          <li>Подозрение на компрометацию учётной записи — до подтверждения личности пользователя.</li>
        </ul>
      </div>
      <div class="legal-sub">
        <div class="legal-sub-title">8.2. Основания для постоянной блокировки</div>
        <ul class="legal-list">
          <li>Нарушение запрещённых действий, перечисленных в разделе 5;</li>
          <li>Предоставление заведомо ложных сведений при регистрации;</li>
          <li>Использование Платформы в незаконных целях;</li>
          <li>Решение суда или предписание уполномоченного органа.</li>
        </ul>
      </div>
      <div class="legal-sub">
        <div class="legal-sub-title">8.3. Последствия блокировки</div>
        <p>При постоянной блокировке за нарушение настоящих Условий средства за оплаченный, но неиспользованный период не возвращаются. Данные учётной записи хранятся 30 дней, после чего безвозвратно удаляются.</p>
      </div>
    </div>
  </section>

  <section class="legal-section" id="s9">
    <div class="legal-section-head"><div class="legal-section-num">09</div><h2>Ограничение ответственности</h2></div>
    <div class="legal-section-body">
      <ul class="legal-list">
        <li>Платформа предоставляется «как есть» (as is). Исполнитель прилагает разумные усилия для обеспечения доступности и корректной работы Сервиса, однако не гарантирует его бесперебойную работу.</li>
        <li>Исполнитель не несёт ответственности за сбои в работе внешних сервисов (маркетплейсов, CRM, платёжных шлюзов, служб доставки), к которым осуществляется интеграция.</li>
        <li>Исполнитель не несёт ответственности за содержимое базы данных 1С пользователя и за корректность данных, передаваемых пользователем через Платформу.</li>
        <li>Совокупная ответственность Исполнителя перед пользователем по любым основаниям не может превышать суммы, фактически уплаченной пользователем за подписку за последние 3 (три) месяца.</li>
        <li>Исполнитель не несёт ответственности за косвенные, случайные или непредвиденные убытки, включая упущенную выгоду, потерю данных или репутационный ущерб.</li>
      </ul>
    </div>
  </section>

  <section class="legal-section" id="s10">
    <div class="legal-section-head"><div class="legal-section-num">10</div><h2>Связанные документы</h2></div>
    <div class="legal-section-body">
      <p>Настоящие Условия являются частью системы правовых документов CoreBridge:</p>
      <ul class="legal-list">
        <li><a href="/oferta">Договор-оферта</a> — регулирует коммерческие отношения между Исполнителем и Заказчиком, порядок оплаты и оказания услуг;</li>
        <li><a href="/privacy">Политика конфиденциальности</a> — описывает порядок сбора, использования и защиты персональных данных пользователей (152-ФЗ, GDPR).</li>
      </ul>
      <p>Используя Платформу, пользователь принимает все три документа совокупно.</p>
    </div>
  </section>

  <section class="legal-section" id="s11">
    <div class="legal-section-head"><div class="legal-section-num">11</div><h2>Изменения условий</h2></div>
    <div class="legal-section-body">
      <p>Исполнитель вправе в одностороннем порядке вносить изменения в настоящие Условия. При существенных изменениях пользователи будут уведомлены:</p>
      <ul class="legal-list">
        <li>Уведомлением в Личном кабинете;</li>
        <li>Сообщением на электронный адрес, указанный при регистрации;</li>
        <li>Баннером в интерфейсе .epf.</li>
      </ul>
      <p>Изменения вступают в силу через 7 (семь) дней после публикации, если иное не предусмотрено самими изменениями. Продолжение использования Платформы после вступления изменений в силу означает их принятие. Актуальная версия всегда доступна по адресу: <a href="/terms">corebridge.ru/terms</a>.</p>
    </div>
  </section>

  <section class="legal-section" id="s12">
    <div class="legal-section-head"><div class="legal-section-num">12</div><h2>Контакты</h2></div>
    <div class="legal-section-body">
      <p>По вопросам, связанным с настоящими Условиями использования, обращайтесь:</p>
      <div class="legal-req">
        <div class="legal-req-title">Исполнитель</div>
        <div class="legal-req-grid">
          <span class="legal-req-label">Наименование</span>
          <span class="legal-req-value">ИП Королёв Дмитрий Павлович</span>
          <span class="legal-req-label">ИНН</span>
          <span class="legal-req-value">120704119287</span>
          <span class="legal-req-label">ОГРНИП</span>
          <span class="legal-req-value">314121813300025</span>
          <span class="legal-req-label">Email</span>
          <span class="legal-req-value"><a href="mailto:info@corebridge.ru">info@corebridge.ru</a></span>
          <span class="legal-req-label">Адрес</span>
          <span class="legal-req-value">424039, Республика Марий Эл, г. Йошкар-Ола, ул. Красноармейская, д. 108А, кв. 39</span>
        </div>
      </div>
    </div>
  </section>

  <hr class="legal-divider">
  <div class="legal-footer">
    <div class="legal-footer-meta">Редакция от 05.05.2026 · corebridge.ru/terms</div>
    <div class="legal-footer-links">
      <a href="/oferta">Оферта</a>
      <a href="/privacy">Конфиденциальность</a>
      <a href="/terms">Условия использования</a>
    </div>
  </div>
6:{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"}
7:{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"}
8:{"display":"inline-block"}
9:{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0}
0:["KN3xYtm_z32avIvHZDIhz",[[["",{"children":["(site)",{"children":["(public)",{"children":["terms",{"children":["__PAGE__",{}]}]}]}]},"$undefined","$undefined",true],["",{"children":["(site)",{"children":["(public)",{"children":["terms",{"children":["__PAGE__",{},[["$L1",[["$","$L2",null,{}],["$","div",null,{"className":"legal-body","children":["$","main",null,{"className":"legal-shell","dangerouslySetInnerHTML":{"__html":"$3"}}]}]],[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/ef577af2a434096b.css","precedence":"next","crossOrigin":"$undefined"}]]],null],null]},[null,["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children","(site)","children","(public)","children","terms","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/f66e7d84d01bab49.css","precedence":"next","crossOrigin":"$undefined"}]],["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children","(site)","children","(public)","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null],null]},[null,["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children","(site)","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":"404"}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],"notFoundStyles":[]}]],null]},[[null,["$","html",null,{"lang":"ru","children":[["$","head",null,{"children":[["$","link",null,{"rel":"stylesheet","href":"/assets/fonts.css"}],["$","link",null,{"rel":"preload","as":"font","type":"font/woff2","href":"/assets/fonts/inter-cyrillic.woff2","crossOrigin":"anonymous"}],["$","link",null,{"rel":"stylesheet","href":"/assets/site.css"}]]}],["$","body",null,{"children":[["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":"$6","children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":"$7","children":"404"}],["$","div",null,{"style":"$8","children":["$","h2",null,{"style":"$9","children":"This page could not be found."}]}]]}]}]],"notFoundStyles":[]}],["$","script",null,{"src":"/assets/mkt.js","defer":true}]]}]]}]],null],null],["$La",null]]]]
a:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Условия использования — CoreBridge"}],["$","meta","3",{"name":"description","content":"Условия использования платформы CoreBridge: тарифы, лимиты, права и обязанности сторон."}],["$","meta","4",{"name":"application-name","content":"CoreBridge"}],["$","meta","5",{"name":"robots","content":"index, follow"}],["$","meta","6",{"name":"googlebot","content":"index, follow, max-image-preview:large, max-snippet:-1"}],["$","link","7",{"rel":"canonical","href":"https://corebridge.ru/terms"}],["$","meta","8",{"property":"og:title","content":"Условия использования — CoreBridge"}],["$","meta","9",{"property":"og:description","content":"Условия использования платформы CoreBridge: тарифы, лимиты, права и обязанности сторон."}],["$","meta","10",{"property":"og:url","content":"https://corebridge.ru"}],["$","meta","11",{"property":"og:site_name","content":"CoreBridge"}],["$","meta","12",{"property":"og:locale","content":"ru_RU"}],["$","meta","13",{"property":"og:image","content":"https://corebridge.ru/og.png"}],["$","meta","14",{"property":"og:image:width","content":"1200"}],["$","meta","15",{"property":"og:image:height","content":"630"}],["$","meta","16",{"property":"og:image:alt","content":"CoreBridge — интеграция 1С"}],["$","meta","17",{"property":"og:type","content":"website"}],["$","meta","18",{"name":"twitter:card","content":"summary_large_image"}],["$","meta","19",{"name":"twitter:title","content":"Условия использования — CoreBridge"}],["$","meta","20",{"name":"twitter:description","content":"Условия использования платформы CoreBridge: тарифы, лимиты, права и обязанности сторон."}],["$","meta","21",{"name":"twitter:image","content":"https://corebridge.ru/og.png"}],["$","link","22",{"rel":"icon","href":"/favicon.ico","type":"image/x-icon","sizes":"48x48"}],["$","link","23",{"rel":"icon","href":"/icon.svg?d5c7994e6576d48e","type":"image/svg+xml","sizes":"any"}],["$","link","24",{"rel":"apple-touch-icon","href":"/apple-icon.png?1ab694eb3d7c7ae5","type":"image/png","sizes":"180x180"}]]
1:null

# Почта corebridge.ru — DNS-записи и настройка

Сервер: Postfix (send-only) + OpenDKIM на VPS 77.90.61.5.
Установлено и проверено 2026-07-26. Отправка идёт напрямую с VPS, порт 25 наружу открыт.

## 1. Записи в панели SpaceWeb (sweb.ru → DNS домена corebridge.ru)

| Тип | Имя (хост) | Значение | TTL |
|-----|-----------|----------|-----|
| A | `mail` | `77.90.61.5` | 3600 |
| TXT | `@` | `v=spf1 ip4:77.90.61.5 -all` | 3600 |
| TXT | `mail._domainkey` | см. ниже (одной строкой) | 3600 |

Значение DKIM (селектор `mail`, RSA-2048):

```
v=DKIM1;h=sha256;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2CGyYnIP6X8+fphVTSwT94C7xVDT6vVr41YCnfePONvOC59DUCmWKHEkAfK5L7wAgknpT/9KCH9Y5Hi0eB2pIZp34J4UkSGTc+WuWGL0YoaTzJS4YrFzIvxxibBAbdcwM/BhKaZsj2pE+51jaks9WcfePIdCw+6YwLFkHj0HiuGso7RJY0w8x1TmnwjTbKMlmZ+FhwT3lvziWc0wNeS8pes4WSXpp9ThFHgO3mhDYgxpPvopm7dHWmXIUtIqC9b3E7elOiBsgz+dE4pz215lnloj4tN90pcQkFc16of/5qDw2gnffmkkY69CGEO0ryusmNiAhShfM38wirhvf1hyYQIDAQAB
```

DMARC (`_dmarc` TXT `v=DMARC1; p=none;`) уже существует — на время прогрева IP оставляем как есть.

**MX-запись пока НЕ добавляем.** Сервер настроен только на отправку; входящая почта —
отдельный этап (MX + virtual alias + открытие 25 порта в ufw для интернета).

## 2. PTR (обратная зона) — у провайдера VPS

Сейчас `77.90.61.5` резолвится в `dejavusca.re`. Нужно `mail.corebridge.ru`.
IP принадлежит GHOSTnet GmbH (netname `Threatoff`) — запрос через панель/тикет провайдера VPS.

Без совпадения PTR ↔ HELO Mail.ru и Яндекс отбраковывают почту жёстко.

## 3. Настройки приложений (в `/opt/corebridge/.env` — правит бэкенд)

```
SMTP_HOST=172.21.0.1     # gateway docker-сети corebridge-internal → Postfix на хосте
SMTP_PORT=25
SMTP_USER=               # аутентификация не нужна: relay разрешён из 172.16.0.0/12
SMTP_PASS=
GF_SMTP_HOST=172.21.0.1:25
GF_SMTP_USER=
GF_SMTP_PASSWORD=
GF_SMTP_SKIP_VERIFY=true
```

Проверено: `corebridge-lk-api` (172.21.0.5) достаёт `172.21.0.1:25` → `220 mail.corebridge.ru ESMTP Postfix`.

Если docker-сеть `corebridge-internal` пересоздадут, gateway может смениться —
Postfix слушает `0.0.0.0:25`, а `mynetworks`/ufw разрешают всю `172.16.0.0/12`,
поэтому достаточно поправить IP в `.env`.

## 4. Что уже сделано на сервере

- `postfix` + `opendkim` установлены, `enable`, запущены
- `inet_interfaces = all`, `inet_protocols = ipv4`, `mynetworks = 127.0.0.0/8 172.16.0.0/12`
- `myhostname = mail.corebridge.ru`, `mydestination` без `corebridge.ru` (send-only)
- OpenDKIM: ключ `/etc/opendkim/keys/corebridge.ru/mail.private`, milter на `127.0.0.1:8891`
- ufw: `allow from 172.16.0.0/12 to any port 25` — из интернета порт 25 закрыт
- Проверено: письмо от `alerts@corebridge.ru` подписывается (`DKIM-Signature ... d=corebridge.ru; s=mail`)

Скрипт настройки: [setup-mail.sh](setup-mail.sh)

## 5. Проверка после публикации DNS

```bash
dig +short TXT mail._domainkey.corebridge.ru      # должен вернуть ключ
dig +short TXT corebridge.ru                       # должен вернуть SPF
dig +short -x 77.90.61.5                           # должен вернуть mail.corebridge.ru
sudo opendkim-testkey -d corebridge.ru -s mail -vvv   # "key OK"
```

Затем — тестовое письмо на Gmail и проверка заголовков: `spf=pass`, `dkim=pass`, `dmarc=pass`.

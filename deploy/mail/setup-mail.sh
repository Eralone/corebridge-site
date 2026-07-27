#!/usr/bin/env bash
# Настройка send-only Postfix + OpenDKIM для corebridge.ru
set -euo pipefail

DOMAIN=corebridge.ru
HOSTNAME=mail.corebridge.ru
SELECTOR=mail

# ── Postfix ────────────────────────────────────────────────────────────────
postconf -e "myhostname = ${HOSTNAME}"
postconf -e "myorigin = ${DOMAIN}"
# corebridge.ru НЕ в mydestination: пока это send-only, входящую почту
# принимаем отдельным шагом (MX + virtual alias)
postconf -e "mydestination = localhost.localdomain, localhost"
postconf -e "relayhost ="
# Слушаем все интерфейсы: контейнеры ходят на gateway docker-сети (172.21.0.1),
# а он может смениться при пересоздании сети. Извне порт 25 закрыт ufw.
postconf -e "inet_interfaces = all"
# Только IPv4: PTR и SPF будут только для 77.90.61.5
postconf -e "inet_protocols = ipv4"
postconf -e "mynetworks = 127.0.0.0/8 172.16.0.0/12"
postconf -e "smtpd_relay_restrictions = permit_mynetworks reject_unauth_destination"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks reject_unauth_destination"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtp_tls_note_starttls_offer = yes"
postconf -e "biff = no"
postconf -e "append_dot_mydomain = no"

# ── OpenDKIM: ключ ─────────────────────────────────────────────────────────
mkdir -p /etc/opendkim/keys/${DOMAIN}
if [ ! -f /etc/opendkim/keys/${DOMAIN}/${SELECTOR}.private ]; then
    opendkim-genkey -b 2048 -d ${DOMAIN} -D /etc/opendkim/keys/${DOMAIN} -s ${SELECTOR}
fi
chown -R opendkim:opendkim /etc/opendkim
chmod 700 /etc/opendkim/keys/${DOMAIN}
chmod 600 /etc/opendkim/keys/${DOMAIN}/${SELECTOR}.private

# ── OpenDKIM: таблицы ──────────────────────────────────────────────────────
cat > /etc/opendkim/key.table <<EOF
${SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${SELECTOR}:/etc/opendkim/keys/${DOMAIN}/${SELECTOR}.private
EOF

cat > /etc/opendkim/signing.table <<EOF
*@${DOMAIN} ${SELECTOR}._domainkey.${DOMAIN}
EOF

cat > /etc/opendkim/trusted.hosts <<EOF
127.0.0.1
localhost
172.16.0.0/12
${DOMAIN}
${HOSTNAME}
EOF

chown opendkim:opendkim /etc/opendkim/key.table /etc/opendkim/signing.table /etc/opendkim/trusted.hosts
chmod 644 /etc/opendkim/key.table /etc/opendkim/signing.table /etc/opendkim/trusted.hosts

# ── OpenDKIM: основной конфиг ──────────────────────────────────────────────
cat > /etc/opendkim.conf <<'EOF'
# Настроен для corebridge.ru — подпись исходящей почты
Syslog                  yes
SyslogSuccess           yes
LogWhy                  no
UMask                   007
UserID                  opendkim

Canonicalization        relaxed/simple
Mode                    s
SubDomains              no
OversignHeaders         From

KeyTable                /etc/opendkim/key.table
SigningTable            refile:/etc/opendkim/signing.table
ExternalIgnoreList      /etc/opendkim/trusted.hosts
InternalHosts           /etc/opendkim/trusted.hosts

Socket                  inet:8891@127.0.0.1
PidFile                 /run/opendkim/opendkim.pid
EOF

# ── Postfix ↔ OpenDKIM ─────────────────────────────────────────────────────
postconf -e "milter_protocol = 6"
postconf -e "milter_default_action = accept"
postconf -e "smtpd_milters = inet:127.0.0.1:8891"
postconf -e "non_smtpd_milters = inet:127.0.0.1:8891"

# ── Firewall: 25 только из docker-сетей, из интернета — нет ────────────────
ufw allow from 172.16.0.0/12 to any port 25 proto tcp comment 'SMTP из docker для приложений' >/dev/null

systemctl restart opendkim
systemctl restart postfix
systemctl enable opendkim postfix >/dev/null 2>&1

echo "OK"

# Промты для обложек: две страницы про маркировку

✅ **Сделано 16.09.** Обе обложки на месте, страницы выложены.
Файл оставлен как образец промта для следующих статей.

⚠️ Формат исходника значения не имеет: `sharp` читает и PNG, и JPEG,
на выходе всегда `.jpg`. Вторая обложка пришла в JPEG, первая в PNG
на 3,8 МБ - обе ужались до 39 и 47 КБ.

Формат тот же, что и раньше: 1200x630, без надписей. Кириллицу генераторы
рисуют криво, поэтому текст в промтах запрещён явно.

Обе картинки должны отличаться от уже существующей обложки про маркировку
(ночной стол с лампой и стопкой этикеток) — она стоит на статье
«Вечера, потраченные на коды маркировки».

---

## 1. Честный знак в 1С:Бухгалтерия 3.0

**Смысл, который надо показать:** цепочка из двух шагов, где второй шаг
не выполняется. Коды в документ попадают, вывод из оборота не создаётся.

**Промт (английский, для Midjourney / DALL-E / Kandinsky):**

```
Flat isometric illustration, a two step process on a clean surface: on the
left a document sheet with an abstract barcode pattern resting in a solid
tray, connected by a short arrow to a second tray on the right which is empty
and drawn only as a dashed outline, the arrow between them faded and
interrupted in the middle, muted corporate palette of deep blue and white with
one warm amber accent on the first tray, clean vector style, soft even
lighting, no text, no letters, no numbers, no logos, generous negative space
at the top, 1200x630 aspect ratio
```

**Что должно получиться:** слева документ со штрихкодом в лотке, справа
пустой лоток пунктиром, стрелка между ними прерывается. Читается без подписи:
первый шаг есть, второго нет.

**Сохранить как:** `marketing/content/drafts/2026-09-16-chestny-znak-bp.png`

---

## 2. Честный знак в 1С:УНФ

**Смысл:** замкнутый цикл. Всё проходит до конца, без ручных шагов.

**Промт (английский):**

```
Flat isometric illustration, a closed circular loop made of three connected
stages: a cardboard box, a document sheet with an abstract barcode pattern,
and a simple check mark badge, arrows running continuously between all three
forming an unbroken ring, muted corporate palette of deep blue and white with
one warm amber accent on the check mark, clean vector style, soft even
lighting, no text, no letters, no numbers, no logos, generous negative space
at the top, 1200x630 aspect ratio
```

**Что должно получиться:** коробка, документ со штрихкодом и галочка,
соединённые стрелками в непрерывное кольцо. Читается как «цикл закрывается».

**Сохранить как:** `marketing/content/drafts/2026-09-16-chestny-znak-unf.png`

---

## После генерации

Положи файлы в `marketing/content/drafts/` под указанными именами и скажи —
я пропишу их в исходники статей, пересоберу и выложу. Пересборка занимает
полминуты, обложки ужимаются автоматически до 24–75 КБ.

⚠️ Если генератор дорисовал текст или цифры — перегенерируй, а не замазывай.
Кривые буквы на обложке выглядят хуже, чем отсутствие обложки: сейчас
страницы стоят без картинок, и это нормально.

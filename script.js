/* ==========================================================
   toothORteeth — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + กรองตาม mood
   - order.html   : เติมฟอร์มจาก URL + ส่งออเดอร์
   - admin.html   : แสดงออเดอร์จาก Google Sheet (CSV)
   สคริปต์ตรวจจาก id ของ element ในหน้า จึงทำงานเฉพาะหน้าที่เกี่ยวข้อง
   ========================================================== */

(() => {
  'use strict';

  /* ---------- Config ---------- */
  const PRODUCTS_URL = 'products.json';

  const ORDER_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbw15bOI8tUMuWtI028Q8tceY5d9W7sT3N-DbDsZ7tMMpZsC2LTrUWzwA2vwHY3e47DV-w/exec';

  const ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRPL9Nlkz6nxuYEjB3_EEbM5boR9s1D6Jf4R0zddPTzSWLZz6M8-BJAS_1DdRAe-lhzrHR_Sxkfbnju/pub?gid=0&single=true&output=csv';

  const MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' },
  ];

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('th-TH') : String(value);
  }

  function moodLabel(key) {
    const found = MOODS.find((m) => m.key === key);
    return found ? found.label : key;
  }

  /* ==========================================================
     1) product.html
     ========================================================== */
  async function initProductPage() {
    const list = document.getElementById('product-list');
    const bar = document.getElementById('filter-bar');
    if (!list) return;

    let products = [];
    try {
      const res = await fetch(PRODUCTS_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      products = await res.json();
    } catch (error) {
      console.error(error);
      list.textContent = 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง';
      return;
    }

    // mood เริ่มต้นจาก ?mood=xxx (ถ้าไม่ถูกต้องให้แสดงทั้งหมด)
    const requested = (new URLSearchParams(window.location.search).get('mood') || '')
      .trim()
      .toLowerCase();
    let activeMood = MOODS.some((m) => m.key === requested) ? requested : 'all';

    function buildCard(product) {
      const card = el('article', 'product-card');
      card.dataset.mood = product.mood;

      const media = el('div', 'product-card__media');
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      img.loading = 'lazy';
      media.appendChild(img);

      const label = el('p', 'mood-label');
      label.append(el('span', 'mood-dot'), moodLabel(product.mood));

      const title = el('h3', 'product-card__title', product.name);
      const meta = el('p', 'product-card__meta', product.size);
      const price = el('p', 'product-card__price', formatNumber(product.price) + ' บาท');

      const orderParams = new URLSearchParams({
        item: product.name + ' ' + product.size,
        price: String(product.price),
      });
      const buy = el('a', 'btn btn--accent btn--block', 'สั่งซื้อ');
      buy.href = 'order.html?' + orderParams.toString();

      card.append(media, label, title, meta, price, buy);
      return card;
    }

    function renderProducts() {
      list.textContent = '';
      const visible =
        activeMood === 'all' ? products : products.filter((p) => p.mood === activeMood);

      if (visible.length === 0) {
        list.appendChild(el('p', 'muted', 'ยังไม่มีสินค้าในหมวดนี้'));
        return;
      }
      visible.forEach((p) => list.appendChild(buildCard(p)));
    }

    function renderFilter() {
      if (!bar) return;
      bar.textContent = '';
      bar.classList.add('filter');

      MOODS.forEach((mood) => {
        const btn = el('button', '');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(mood.key === activeMood));
        if (mood.key !== 'all') {
          btn.dataset.mood = mood.key;
          btn.appendChild(el('span', 'mood-dot'));
        }
        btn.append(mood.label);
        btn.addEventListener('click', () => setMood(mood.key));
        bar.appendChild(btn);
      });
    }

    function setMood(key) {
      activeMood = key;

      // อัปเดต URL เพื่อให้คัดลอกลิงก์ที่กรองไว้แล้วไปใช้ต่อได้
      try {
        const url = new URL(window.location.href);
        if (key === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', key);
        window.history.replaceState(null, '', url);
      } catch (e) {
        /* ไม่เป็นไร ถ้าเบราว์เซอร์ไม่อนุญาต */
      }

      renderFilter();
      renderProducts();
    }

    renderFilter();
    renderProducts();
  }

  /* ==========================================================
     2) order.html
     ========================================================== */
  function initOrderPage() {
    const form = document.getElementById('orderForm');
    if (!form) return;

    const itemsInput = document.getElementById('items');
    const totalInput = document.getElementById('total');

    // เติมค่าจาก URL ทันทีที่โหลดหน้า — ทั้งช่อง items และ total
    const params = new URLSearchParams(window.location.search);
    const item = params.get('item');
    const price = params.get('price');
    if (itemsInput && item !== null) itemsInput.value = item;
    if (totalInput && price !== null) totalInput.value = price;

    const valueOf = (id) => {
      const node = document.getElementById(id);
      return node ? node.value.trim() : '';
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const payload = {
        customerName: valueOf('customerName'),
        contact: valueOf('contact'),
        items: valueOf('items'),
        total: valueOf('total'),
        note: valueOf('note'),
      };

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำ

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  /* ==========================================================
     3) admin.html
     ========================================================== */

  // parse CSV เอง: รองรับเครื่องหมายคำพูด, "" (escape), คอมมาและขึ้นบรรทัดใหม่ในช่อง, CRLF
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  }

  async function initAdminPage() {
    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    const COLUMNS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

    function showMessage(message) {
      tbody.textContent = '';
      const tr = document.createElement('tr');
      const td = el('td', 'muted', message);
      td.colSpan = COLUMNS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage('กำลังโหลดข้อมูล...');

    let rows;
    try {
      const res = await fetch(ORDERS_CSV_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      rows = parseCSV(await res.text());
    } catch (error) {
      console.error(error);
      showMessage('ไม่สามารถโหลดข้อมูลออเดอร์ได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    rows.shift(); // แถวแรกคือหัวตาราง

    if (rows.length === 0) {
      showMessage('ยังไม่มีออเดอร์');
      return;
    }

    // เรียงล่าสุดขึ้นก่อน:
    // ถ้าอ่านวันเวลาได้ทุกแถวให้เรียงตามเวลา มิฉะนั้นกลับลำดับแถว
    // (ชีตเพิ่มออเดอร์ใหม่ต่อท้ายเสมอ)
    const times = rows.map((r) => Date.parse(r[0]));
    if (times.every((t) => !Number.isNaN(t))) {
      rows = rows
        .map((r, i) => ({ r, t: times[i], i }))
        .sort((a, b) => b.t - a.t || b.i - a.i)
        .map((x) => x.r);
    } else {
      rows.reverse();
    }

    tbody.textContent = '';
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      for (let c = 0; c < COLUMNS; c++) {
        let value = (r[c] || '').trim();
        if (c === 4 && value !== '' && Number.isFinite(Number(value))) {
          value = formatNumber(value); // จำนวนเงินรวม
        }
        tr.appendChild(el('td', '', value));
      }
      tbody.appendChild(tr);
    });
  }

  /* ---------- Start ---------- */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

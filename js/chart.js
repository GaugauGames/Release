const ALL_METRICS = [...BOSS_METRICS, ...EXTRA_METRICS];
const STORAGE_CURRENT = "salmonrun.current.v4";
const STORAGE_HISTORY = "salmonrun.history.v4";
const HISTORY_LIMIT = 20;		// 履歴の最大件数
const HISTORY_CHART_LIMIT = 10;	// 履歴チャートに表示する最大件数

const bossInputsEl = document.getElementById("bossInputs");
const extraInputsEl = document.getElementById("extraInputs");
const historyListEl = document.getElementById("historyList");
const recordDateEl = document.getElementById("recordDate");
const historyMetricSelectEl = document.getElementById("historyMetricSelect");
const mainCanvas = document.getElementById("mainChart");
const historyCanvas = document.getElementById("historyChart");
const mainCtx = mainCanvas.getContext("2d");
const historyCtx = historyCanvas.getContext("2d");
const historySelect = document.getElementById("historySelect");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const csvImportInput = document.getElementById("csvImportInput");
const chartModeEl = document.getElementById("chartMode");

function css(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
const CATEGORY_COLOR = { near: css("--near"), mid: css("--mid"), far: css("--far"), extra: css("--extra") };

// 日付を取得
function todayISO(date = new Date()){
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function defaults(){ return Object.fromEntries(ALL_METRICS.map(m => [m.key, 0])); }
function loadJSON(key, fallback){ try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }

let currentState = loadJSON(STORAGE_CURRENT, { date: todayISO(), values: defaults() });
let historyState = Array.isArray(loadJSON(STORAGE_HISTORY, [])) ? loadJSON(STORAGE_HISTORY, []) : [];
if (!currentState.values) currentState.values = defaults();
if (!currentState.date) currentState.date = todayISO();

function saveCurrent(){ localStorage.setItem(STORAGE_CURRENT, JSON.stringify(currentState)); }
function saveHistory(){ localStorage.setItem(STORAGE_HISTORY, JSON.stringify(historyState.slice(-HISTORY_LIMIT))); }
function metricByKey(key){ return ALL_METRICS.find(m => m.key === key); }

// 最新の履歴を取得
function getLatestHistoryEntry(){
	if (!historyState.length) return null;

	return historyState.reduce((a, b) =>
		a.date > b.date ? a : b
	);
}

// 最新の履歴を入力欄に反映
function initCurrentFromLatestHistoryWithTodayDate(){
	const today = todayISO();

	// 今日データ優先
	const todayEntry = historyState.find(e => e.date === today);

	if (todayEntry){
		currentState.values = { ...defaults(), ...todayEntry.values };
	} else {
		// なければ最新履歴をセット
		const latest = getLatestHistoryEntry();
		currentState.values = latest
			? { ...defaults(), ...latest.values }
			: defaults();
	}

	// 日付は「今日」
	currentState.date = today;

	saveCurrent();

	// 日付フィールド反映
	recordDateEl.value = currentState.date;

	// 入力欄へ反映
	document.querySelectorAll(".metric-input").forEach(input => {
		const key = input.dataset.key;
		input.value = currentState.values[key] ?? 0;
	});
}

// ----------------------------------------
// 履歴を日付順にソートし、差分を再計算する
// ----------------------------------------
function sortAndRecalculateHistory(entries){
	const sorted = [...entries].sort((a, b) => {
		const d = String(a.date || "").localeCompare(String(b.date || ""));
		if (d !== 0) return d;
		return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
	}).slice(-HISTORY_LIMIT);

	let prev = null;
	sorted.forEach(entry => {
		entry.deltas = entry.deltas || {};
		ALL_METRICS.forEach(metric => {
			const now = entry.values?.[metric.key] ?? 0;
			const before = prev?.values?.[metric.key] ?? now;
			entry.deltas[metric.key] = now - before;
		});
		prev = entry;
	});
	return sorted;
}

historyState = sortAndRecalculateHistory(historyState);
saveHistory();

function buildGrid(rootEl, metrics){
	rootEl.innerHTML = "";
	metrics.forEach(metric => {
		const card = document.createElement("label");
		card.className = `metric-cell ${metric.category}`;
		card.innerHTML = `
			<div class="metric-title">${metric.name}</div>
			<input class="metric-input" type="number" min="0" step="1" value="${currentState.values?.[metric.key] ?? 0}" data-key="${metric.key}" aria-label="${metric.name}の入力値">
		`;
		rootEl.appendChild(card);
	});
}

// ----------------------------------------
// 入力欄のイベントを設定
// ----------------------------------------
function wireInputs(){
	document.querySelectorAll(".metric-input").forEach(input => {
		input.addEventListener("input", () => {
			const key = input.dataset.key;
			currentState.values[key] = Math.max(0, Number(input.value) || 0);
			saveCurrent();
			renderAll();
		});
	});
}

// ----------------------------------------
// 描画：履歴メトリック選択
// ----------------------------------------
function initMetricSelect(){
	historyMetricSelectEl.innerHTML = ALL_METRICS.map(m => `<option value="${m.key}">${m.name}</option>`).join("");
	historyMetricSelectEl.selectIndex = 0;
	historyMetricSelectEl.addEventListener("change", renderHistoryChart);
}

// ----------------------------------------
// データ保存
// ----------------------------------------
function saveSnapshot(){
	const date = recordDateEl.value || todayISO();

	// 同日チェック
	const existingIndex = historyState.findIndex(e => e.date === date);

	// 保存データ
	const entry = {
		date,
		values: { ...defaults(), ...currentState.values },
		createdAt: new Date().toISOString(),
		deltas: {}
	};

	if (existingIndex !== -1) {
		// 上書き
		historyState[existingIndex] = entry;
	} else {
		// 新規追加
		historyState.push(entry);
	}

	// ソート＋差分再計算＋20件制限
	historyState = sortAndRecalculateHistory(historyState)
		.slice(-HISTORY_LIMIT);

	saveHistory();
	updateHistorySelect();
	
	// 保存した日付のデータを選択
	const index = historyState.findIndex(e => e.date === date);
	if (index !== -1){
		historySelect.value = String(index);
	}

	renderAll();
	renderHistoryList();
	renderHistoryChart();
}

// 入力欄を初期化(0にする)
function resetInputs(){
	currentState = { date: todayISO(), values: defaults() };
	saveCurrent();

	// UIに反映
	recordDateEl.value = currentState.date;
	share_txt = "";

	document.querySelectorAll(".metric-input").forEach(input => {
		input.value = 0;
	 });
	renderAll();
}

// 履歴一件分の詳細を表示
function renderHistoryList(){
	if (!historyState.length) {
		historyListEl.innerHTML = '<p class="empty-text">履歴はまだありません。</p>';
		return;
	}
	let targetEntry = null;

	// 選択している履歴があれば読込、なければ最新の履歴を読込
	targetEntry = getChartSourceEntry();

	const rows = ALL_METRICS.map(metric => {
		const value = targetEntry.values?.[metric.key] ?? 0;
		const delta = targetEntry.deltas?.[metric.key] ?? 0;
		const cls = delta > 0 ? 'plus' : delta === 0 ? 'zero' : 'minus';
		return `<div class="history-grid-row"><span>${metric.name}</span><span class="num">${value}</span><span class="num delta ${cls}">${delta > 0 ? `+${delta}` : `${delta}`}</span></div>`;
	}).join("");

	historyListEl.innerHTML = `
		<section class="history-entry">
			<h3>${targetEntry.date}</h3>
			<div class="history-grid-head"><span>項目</span><span class="num">値</span><span class="num">差分</span></div>
			${rows}
		</section>`;
}

// 履歴コンボボックスを設定
function updateHistorySelect(){
	if (!historyState.length){
		historySelect.innerHTML = '<option>履歴なし</option>';
		return;
	}

	// 履歴リストを降順に並び変える
	const reversed = historyState
		.map((r,i) => ({ r, i }))
		.reverse();

	// 降順リストをコンボボックスにセット
	historySelect.innerHTML = reversed
		.map(({ r, i }) => `<option value="${i}">${r.date}</option>`)
		.join("");

	// 最新 or 登録した履歴を選択
	const today = currentState.date;
	const todayIndex = historyState.findIndex(e => e.date === today);

	if (todayIndex !== -1){
		historySelect.value = String(todayIndex);
	} else {
		historySelect.value = String(historyState.length - 1);
	}
}

function loadSelectedHistoryIntoForm(){
	const idx = Number(historySelect.value);
	const entry = historyState[idx];

	if (!entry) return;

	// 値をコピー
	currentState.values = { ...entry.values };

	// 日付も切り替える
	currentState.date = entry.date;

	saveCurrent();

	// 入力欄へ反映
	document.querySelectorAll(".metric-input").forEach(input => {
		const key = input.dataset.key;
		input.value = currentState.values[key] ?? 0;
	});

	// 日付欄反映
	document.getElementById("recordDate").value = entry.date;

	renderAll();
}

// ----------------------------------------
// 描画：履歴チャート
// ----------------------------------------
function renderHistoryChart(){
	historyCtx.clearRect(0, 0, historyCanvas.width, historyCanvas.height);
	fillRound(historyCtx, 0, 0, historyCanvas.width, historyCanvas.height, 22, "#ffffff");
	const metric = metricByKey(historyMetricSelectEl.value || "goldenEggs") || ALL_METRICS[0];

	const chartMode = chartModeEl.value || CHART_MODE.DELTA;
	let points = [];

	switch (chartMode) {
		case CHART_MODE.DELTA:
			// 差分チャート用のデータを作成
			points = buildDeltaPoints(metric.key);
			break;
		case CHART_MODE.DAILY_AVERAGE:
			// 日平均値チャート用のデータを作成
			points = buildDailyAveragePoints(metric.key);
			break;
	}

	const modeName =
		chartModeEl.value === CHART_MODE.DAILY_AVERAGE
			? "日平均" : "差分";

	drawText(historyCtx, `${metric.name} (${modeName})の推移(直近${HISTORY_CHART_LIMIT}件)`, 24, 36, 20, "#2d160d", 900);
	if (!points.length) {
		drawText(historyCtx, "履歴はまだありません。", 24, 72, 14, "#7a4a36", 700);
		return;
	}

	const pad = { top: 50, right: 28, bottom: 54, left: 44 };
	const chartW = historyCanvas.width - pad.left - pad.right;
	const chartH = historyCanvas.height - pad.top - pad.bottom;
	const maxValue = Math.ceil(Math.max(1, ...points.map(p => p.value)) / 100) * 100; // 100の倍数に丸める

	historyCtx.strokeStyle = "#e6c5b3";
	historyCtx.lineWidth = 1;
	historyCtx.beginPath();
	historyCtx.moveTo(pad.left, pad.top);
	historyCtx.lineTo(pad.left, pad.top + chartH);
	historyCtx.lineTo(pad.left + chartW, pad.top + chartH);
	historyCtx.stroke();
	const fontSize = 18;	// 目盛りのフォントサイズ

	for (let i = 1; i <= 4; i++) {
		const y = pad.top + chartH - (chartH * i / 4);
		historyCtx.beginPath();
		historyCtx.moveTo(pad.left, y);
		historyCtx.lineTo(pad.left + chartW, y);
		historyCtx.strokeStyle = "#f1d8ca";
		historyCtx.stroke();
		drawText(historyCtx, String(Math.round(maxValue * i / 4)), pad.left - 8, y + 4, fontSize, "#7a4a36", 700, "right");
	}

	historyCtx.beginPath();
	points.forEach((p, i) => {
		const x = pad.left + (chartW * i / Math.max(1, points.length - 1));
		const y = pad.top + chartH - (p.value / maxValue) * chartH;
		if (i === 0) historyCtx.moveTo(x, y); else historyCtx.lineTo(x, y);
	});
	historyCtx.strokeStyle = css("--salmonrun");
	historyCtx.lineWidth = 3;
	historyCtx.stroke();

	points.forEach((p, i) => {
		const x = pad.left + (chartW * i / Math.max(1, points.length - 1));
		const y = pad.top + chartH - (p.value / maxValue) * chartH;
		historyCtx.beginPath();
		historyCtx.arc(x, y, 4.5, 0, Math.PI * 2);
		historyCtx.fillStyle = css("--salmonrun");
		historyCtx.fill();
		historyCtx.strokeStyle = "#fff";
		historyCtx.lineWidth = 2;
		historyCtx.stroke();
		drawText(historyCtx, String(p.value), x, y - 10, fontSize, "#2d160d", 800, "center");
		drawText(historyCtx, p.date.slice(5), x, pad.top + chartH + 22, fontSize, "#7a4a36", 700, "center");
	});
}

// ----------------------------------------
// 描画モード
// ----------------------------------------
const CHART_MODE = {
	DELTA: "delta",
	DAILY_AVERAGE: "dailyAverage"
};

// ----------------------------------------
// 描画：差分チャート用のデータを作成
// ----------------------------------------
function buildDeltaPoints(metricKey) {
	return historyState
		.slice(1)
		.slice(-HISTORY_CHART_LIMIT)
		.map(entry => ({
			date: entry.date,
			value: entry.deltas?.[metricKey] ?? 0
		}));
}

// ----------------------------------------
// 描画：日平均値チャート用のデータを作成
// ----------------------------------------
function buildDailyAveragePoints(metricKey) {
	const points = [];
	for (let i = 1; i < historyState.length; i++) {
		const current = historyState[i];
		const previous = historyState[i - 1];
		const currentValue =
			current.values?.[metricKey] ?? 0;
		const previousValue =
			previous.values?.[metricKey] ?? 0;
		const days =
			Math.max(
				1,
				Math.round(
					(new Date(current.date) - new Date(previous.date))
					/ (1000 * 60 * 60 * 24)
				)
			);
		points.push({
			date: current.date,
			value: Number(
				((currentValue - previousValue) / days).toFixed(1)
			)
		});
	}
	return points.slice(-HISTORY_CHART_LIMIT);
}

function renderAll(){
	const entry = getChartSourceEntry();
	const bossData = orderedBossData(entry);
	const stats = bossStatsFrom(bossData);
	renderMainChart(bossData, stats, entry);
}

// チャート表示用のデータを取得
function getChartSourceEntry(){
	// 選択優先
	const idx = Number(historySelect.value);
	if (!Number.isNaN(idx) && historyState[idx]) {
		return historyState[idx];
	}

	// なければ最新
	if (historyState.length){
		return historyState[historyState.length - 1];
	}

	return null;
}

// ----------------------------------------
// チャート表示用のデータを整形
// ----------------------------------------
function orderedBossData(entry){
	if (!entry) return null;

	const values = entry.values;
	return BOSS_METRICS.map(metric => ({ ...metric, value: Number(values?.[metric.key] || 0) }));
}

// ----------------------------------------
// 統計情報を計算
// ----------------------------------------
function bossStatsFrom(data){
	if (!data) return null;

	const total = data.reduce((sum, d) => sum + d.value, 0);
	const byCategory = { near: 0, mid: 0, far: 0 };
	data.forEach(d => { byCategory[d.category] += d.value; });
	const top3 = [...data].sort((a,b) => b.value - a.value || a.name.localeCompare(b.name, "ja")).slice(0, 3);
	const maxValue = Math.ceil(Math.max(10, ...data.map(d => d.value)) / 5000) * 5000; // 5000の倍数に丸める
	return { total, byCategory, top3, maxValue };
}

// ----------------------------------------
// 描画：メインチャート
// ----------------------------------------
function renderMainChart(data, stats, entry){
	mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

	fillRound(mainCtx, 0, 0, mainCanvas.width, mainCanvas.height, 28, "#ffffff");
	drawText(mainCtx, "サーモンラン オオモノ討伐グラフ", 38, 58, 30, "#2d160d", 900);
	if (!entry){
		drawText(mainCtx, "履歴はまだありません。", 45, 90, 20, "#7a4a36", 700);
		return;
	}

	drawText(mainCtx, `${entry.date} の記録`, 38, 90, 20, "#7a4a36", 700);
	// グラフ描画
	const centerX = 600, centerY = 600, radius = 450, levels = 5, N = data.length;
	for (let lv = 1; lv <= levels; lv++) {
		const r = radius * (lv / levels);
		mainCtx.beginPath();
		data.forEach((_, i) => {
			const a = angleAt(i, N), x = centerX + Math.cos(a) * r, y = centerY + Math.sin(a) * r;
			if (i === 0) mainCtx.moveTo(x, y); else mainCtx.lineTo(x, y);
		});
		mainCtx.closePath();
		mainCtx.strokeStyle = lv === levels ? "#e3c2af" : "#f0d8cb";
		mainCtx.lineWidth = 1;
		mainCtx.stroke();
	}
	// 目盛線を描画
	data.forEach((_, i) => {
		const a = angleAt(i, N);
		mainCtx.beginPath();
		mainCtx.moveTo(centerX, centerY);
		mainCtx.lineTo(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius);
		mainCtx.strokeStyle = "#f0d8cb";
		mainCtx.stroke();
	});
	for (let lv = 1; lv <= levels; lv++) drawText(mainCtx, String(Math.round(stats.maxValue * lv / levels)), centerX + 10, centerY - radius * (lv / levels), 20, "#a66b52", 700);

	// データを描画
	mainCtx.beginPath();
	data.forEach((d, i) => {
		const ratio = d.value / stats.maxValue, a = angleAt(i, N), x = centerX + Math.cos(a) * radius * ratio, y = centerY + Math.sin(a) * radius * ratio;
		if (i === 0) mainCtx.moveTo(x, y); else mainCtx.lineTo(x, y);
	});
	mainCtx.closePath();
	mainCtx.fillStyle = css("--primary-fill");
	mainCtx.strokeStyle = css("--salmonrun");
	mainCtx.lineWidth = 3;
	mainCtx.fill();
	mainCtx.stroke();

	// データポイントとラベルを描画
	data.forEach((d, i) => {
		const a = angleAt(i, N), ratio = d.value / stats.maxValue;
		const x = centerX + Math.cos(a) * radius * ratio, y = centerY + Math.sin(a) * radius * ratio;
		const lx = centerX + Math.cos(a) * (radius + 52), ly = centerY + Math.sin(a) * (radius + 52);
		mainCtx.beginPath();
		mainCtx.arc(x, y, 6, 0, Math.PI * 2);
		mainCtx.fillStyle = CATEGORY_COLOR[d.category];
		mainCtx.fill();
		mainCtx.strokeStyle = "#fff";
		mainCtx.lineWidth = 2;
		mainCtx.stroke();
		drawNameChip(d.name, lx, ly, CATEGORY_COLOR[d.category], a);
		drawText(mainCtx, String(d.value), centerX + Math.cos(a) * (radius + 24), centerY + Math.sin(a) * (radius + 24), 20, "#5f2f1d", 800, "center");
	});

	drawLegend();
	drawTop3Card(50, 1120, 440, 220, stats.top3);
	drawCategoryCard(500, 1120, 690, 220, stats);
	drawDeltaTable(50, 1350, 1135, 200, entry);
}

// ----------------------------------------
// 描画：凡例
// ----------------------------------------
function drawLegend(){
	[ [60, css("--near"), "近距離"], [170, css("--mid"), "中距離"], [280, css("--far"), "遠距離"] ].forEach(([x,c,label]) => {
		mainCtx.beginPath(); mainCtx.arc(x, 110, 6, 0, Math.PI * 2); mainCtx.fillStyle = c; mainCtx.fill(); drawText(mainCtx, label, x + 14, 120, 20, "#7a4a36", 800);
	});
	mainCtx.beginPath();
	mainCtx.moveTo(408, 104); mainCtx.lineTo(418, 109); mainCtx.lineTo(414, 119); mainCtx.lineTo(400, 115); mainCtx.lineTo(396, 105); mainCtx.closePath();
	mainCtx.fillStyle = css("--primary-fill"); mainCtx.strokeStyle = css("--salmonrun"); mainCtx.lineWidth = 2; mainCtx.fill(); mainCtx.stroke();
	drawText(mainCtx, "今回値", 426, 120, 20, "#7a4a36", 800);
}

// ----------------------------------------
// 描画：トップ3カード
// ----------------------------------------
function drawTop3Card(x, y, w, h, top3){
	fillRound(mainCtx, x, y, w, h, 18, "#fffdfa"); strokeRound(mainCtx, x, y, w, h, 18, "#efc9b4");
	drawText(mainCtx, "トップ3", x + 18, y + 34, 24, "#2d160d", 900);
	top3.forEach((item, i) => {
		const yy = y + 78 + i * 48;
		mainCtx.beginPath(); mainCtx.arc(x + 28, yy, 14, 0, Math.PI * 2); mainCtx.fillStyle = i===0 ? "#fde68a" : i===1 ? "#e0ecff" : "#fee2e2"; mainCtx.fill();
		drawText(mainCtx, String(i + 1), x + 28, yy + 4, 15, "#2d160d", 900, "center");
		drawText(mainCtx, item.name, x + 56, yy - 2, 18, "#2d160d", 800);
		drawText(mainCtx, CATEGORY_LABEL[item.category], x + 56, yy + 16, 18, CATEGORY_COLOR[item.category], 800);
		drawText(mainCtx, String(item.value), x + w - 20, yy + 6, 22, "#2d160d", 900, "right");
	});
}

// ----------------------------------------
// 描画：カテゴリ割合カード
// ----------------------------------------
function drawCategoryCard(x, y, w, h, stats){
	fillRound(mainCtx, x, y, w, h, 18, "#fffdfa"); strokeRound(mainCtx, x, y, w, h, 18, "#efc9b4");
	drawText(mainCtx, "分類割合", x + 18, y + 34, 24, "#2d160d", 900);
	const total = Math.max(1, stats.total), barX = x + 18, barY = y + 60, barW = w - 36, barH = 34;
	const nearW = barW * (stats.byCategory.near / total), midW = barW * (stats.byCategory.mid / total), farW = barW * (stats.byCategory.far / total);
	fillRound(mainCtx, barX, barY, barW, barH, 18, "#f7e4d8");
	if (nearW > 0) fillRound(mainCtx, barX, barY, nearW, barH, 18, css("--near"));
	if (midW > 0) fillRect(mainCtx, barX + nearW, barY, midW, barH, css("--mid"));
	if (farW > 0) fillRound(mainCtx, barX + nearW + midW, barY, farW, barH, 18, css("--far"));

	// 割合を計算して表示
	const pct = (v) => stats.total ? ((v / stats.total) * 100).toFixed(1) : "0.0";

	drawText(mainCtx, `近距離 ${pct(stats.byCategory.near)}%`, x + 18, y + 124, 22, css("--near"), 900);
	drawText(mainCtx, `中距離 ${pct(stats.byCategory.mid)}%`, x + 260, y + 124, 22, css("--mid"), 900);
	drawText(mainCtx, `遠距離 ${pct(stats.byCategory.far)}%`, x + 500, y + 124, 22, css("--far"), 900);
}

// ----------------------------------------
// 描画：差分テーブル
// ----------------------------------------
function drawDeltaTable(x, y, w, h, entry){
	fillRound(mainCtx, x, y, w, h, 18, "#fffdfa"); strokeRound(mainCtx, x, y, w, h, 18, "#efc9b4");
	drawText(mainCtx, "オカシラ、金イクラ", x + 18, y + 34, 24, "#2d160d", 900);
	EXTRA_METRICS.forEach((m, i) => {
		let yy = y + 84 + i * 44; 
		const v = entry.values?.[m.key] ?? 0; 
		const d = entry.deltas?.[m.key] ?? 0;
		if(i > 2){
			x = 600;
			yy = yy - 3 * 44;
		}
		drawText(mainCtx, m.name, x + 20, yy, 20, "#2d160d", 800);
		drawText(mainCtx, `${v}`, x + 300, yy, 20, "#7a4a36", 700, "right");
		drawText(mainCtx, d > 0 ? `+${d}` : `${d}`, x + 400, yy, 18, d > 0 ? css("--plus") : css("--zero"), 900, "right");
	});
}

// ----------------------------------------
// 描画：名前チップ
// ----------------------------------------
function drawNameChip(text, x, y, bg, angle){
	const padX = 9;
	const w = Math.max(54, measureText(mainCtx, text, 20, 800) + padX * 2);
	const h = 26;
	let left = x - w / 2
	let top = y - h / 2 - 15;
	// 角度に応じて位置を微調整
	if (Math.cos(angle) > 0.35) left -= 4; 
	if (Math.cos(angle) < -0.35) left += 4;

	if (Math.sin(angle) > 0.45) top += 15;		// 下側
	else if (Math.sin(angle) < -0.45) top += 4;	// 上側
	else if (Math.sin(angle) > 0) top -= 28;	// 左右真横
	else top -= 10;								// 左右上側

	fillRound(mainCtx, left, top, w, h, 13, bg);
	drawText(mainCtx, text, left + w / 2, top + 17, 20, "#ffffff", 900, "center");
}

function angleAt(index, total){ return Math.PI * 2 * index / total - Math.PI / 2; }
function drawText(ctx, text, x, y, size = 20, color = "#000", weight = 400, align = "left"){
	ctx.save(); ctx.font = `${weight} ${size}px sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(text, x, y); ctx.restore();
}
function measureText(ctx, text, size = 12, weight = 400){ ctx.save(); ctx.font = `${weight} ${size}px sans-serif`; const w = ctx.measureText(text).width; ctx.restore(); return w; }
function roundRectPath(ctx, x, y, w, h, r){ const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2)); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
function fillRound(ctx, x, y, w, h, r, fill){ ctx.save(); roundRectPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }
function strokeRound(ctx, x, y, w, h, r, stroke){ ctx.save(); roundRectPath(ctx, x, y, w, h, r); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
function fillRect(ctx, x, y, w, h, fill){ ctx.save(); ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.restore(); }
function formatFileDate(date = new Date()){ const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,"0"), d=String(date.getDate()).padStart(2,"0"), hh=String(date.getHours()).padStart(2,"0"), mm=String(date.getMinutes()).padStart(2,"0"); return `${y}${m}${d}-${hh}${mm}`; }
function saveImage(){
	 const a=document.createElement("a");
	 a.download=`salmon-chart-${formatFileDate()}.png`;
	 a.href=mainCanvas.toDataURL("image/png");
	 a.click(); 
	}

// 投稿用テキストを編集
function editShareText(type){
	share_txt = "";

	const entry = getChartSourceEntry();
	const bossData = orderedBossData(entry);
	const stats = bossStatsFrom(bossData);
	const deltas = entry.deltas

	const top3 = stats.top3.map((d,i)=>`${i+1}位 ${d.name} ${d.value}(+${deltas?.[d.key]})`).join("\n");
	//const eggs = entry.values["goldenEggs"] ?? 0;

	const textPrefix=("オオモノ討伐数を更新！").trim();
	const text = `${textPrefix}\n${entry.date || todayISO()}\nTOP3\n${top3}\n`;
					//\n\n金イクラ ${eggs}\n`;

	add_result_txt(text);

	if (type === "clipboard"){
		result_copy();
	}
	else{
		postResultSNS(type, false);
	}
}

function clearHistory(){
	share_txt = "";
	historyState=[];
	saveHistory(); 
	updateHistorySelect();
	renderHistoryList();
	renderHistoryChart();
	renderAll();
}

// ----------------------------------------
// 共通：CSVセルのエスケープ
// ----------------------------------------
function csvEscape(value) {
	const str = String(value ?? "");
	if (/[",\n\r]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

// ----------------------------------------
// Export: historyState -> CSV
// ヘッダーは name（表示名）
// ----------------------------------------
function exportCSV() {
	if (!historyState.length) {
		alert("履歴がありません");
		return;
	}

	// 1) ヘッダー
	const headers = [
		"日付",
		...ALL_METRICS.map(m => m.name),
		...ALL_METRICS.map(m => `${m.name}(差分)`)
	];

	// 2) 行データ
	const rows = historyState.map(entry => {
		return [
			entry.date,
			...ALL_METRICS.map(m => entry.values?.[m.key] ?? 0),
			...ALL_METRICS.map(m => entry.deltas?.[m.key] ?? 0)
		];
	});

	// 3) CSV文字列化
	const csvText = [
		headers.map(csvEscape).join(","),
		...rows.map(row => row.map(csvEscape).join(","))
	].join("\r\n");

	// 4) UTF-8 BOM付きでダウンロード
	const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
	const blob = new Blob([bom, csvText], {
		type: "text/csv;charset=utf-8;"
	});

	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `salmon_history_${todayISO()}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// ----------------------------------------
// Import用：1行CSVパース
// ダブルクォート対応
// ----------------------------------------
function parseCsvLine(line) {
	const result = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];

		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (ch === "," && !inQuotes) {
			result.push(current);
			current = "";
		} else {
			current += ch;
		}
	}

	result.push(current);
	return result;
}

// ----------------------------------------
// name -> key 変換表
// （このツールが出力したCSV専用）
// ----------------------------------------
function buildNameToKeyMap() {
	const map = {
		"日付": "date"
	};

	ALL_METRICS.forEach(m => {
		map[m.name] = m.key;
		map[`${m.name}(差分)`] = `${m.key}_delta`;
	});

	return map;
}

function normalizeDate(input){
	if (!input) return "";

	let str = String(input).trim();

	// 日付形式を yyyy-mm-dd に統一
	str = str.replace(/\.|\//g, "-");

	// YYYY-M-D → YYYY-MM-DD に変換
	const parts = str.split("-");

	if (parts.length !== 3) return "";

	const [y, m, d] = parts;

	const mm = m.padStart(2, "0");
	const dd = d.padStart(2, "0");

	return `${y}-${mm}-${dd}`;
}

function isValidDate(dateStr){
	// 形式チェック YYYY-MM-DD
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		return false;
	}

	// 実在する日付かチェック
	const [y, m, d] = dateStr.split("-").map(Number);

	const date = new Date(y, m - 1, d);

	return (
		date.getFullYear() === y &&
		date.getMonth() === m - 1 &&
		date.getDate() === d
	);
}
// ----------------------------------------
// Import: CSV文字列 -> historyState
// 前提：ヘッダーは name（表示名）
// ----------------------------------------
function importCSVText(text) {
	// 1) 改行統一
	const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	const lines = normalized.split("\n").filter(line => line.trim() !== "");

	if (!lines.length) {
		alert("CSVが空です");
		return;
	}

	// 2) ヘッダー行読み取り
	lines[0] = lines[0].replace(/^\uFEFF/, ""); // BOM除去
	const headerRow = parseCsvLine(lines[0]);

	const nameToKey = buildNameToKeyMap();

	// 3) ヘッダーを内部キー化
	const normalizedKeys = headerRow.map(h => {
		const trimmed = String(h || "").trim();
		const key = nameToKey[trimmed];
		if (!key) {
			throw new Error(`不明な列名です: ${trimmed}`);
		}
		return key;
	});

	// 4) 必須列チェック
	const requiredKeys = [
		"date",
		...ALL_METRICS.map(m => m.key)
	];

	const missing = requiredKeys.filter(k => !normalizedKeys.includes(k));
	if (missing.length) {
		throw new Error(`必須列が不足しています: ${missing.join(", ")}`);
	}

	// 5) データ行を entry 化
	const importedEntries = [];

	for (let i = 1; i < lines.length; i++) {
		const cols = parseCsvLine(lines[i]);

		// 空行スキップ
		if (!cols.length || cols.every(c => String(c).trim() === "")) continue;

		// 行データを内部キーで record 化
		const record = {};
		normalizedKeys.forEach((key, idx) => {
			record[key] = cols[idx] ?? "";
		});

		if (!record.date || !String(record.date).trim()) continue;
		const normalizedDate = normalizeDate(record.date);

		// バリデーション追加
		if (!isValidDate(normalizedDate)){
			throw new Error(`日付が不正です（${i+1}行目）: ${record.date}`)
		}

		const entry = {
			date: normalizedDate,
			createdAt: new Date().toISOString(),
			values: { ...defaults() },
			deltas: {}
		};

		// values
		ALL_METRICS.forEach(m => {
			entry.values[m.key] = Number(record[m.key] || 0);
		});

		// deltas（読めるなら読む。ただし最後に再計算される）
		ALL_METRICS.forEach(m => {
			entry.deltas[m.key] = Number(record[`${m.key}_delta`] || 0);
		});

		importedEntries.push(entry);
	}

	// 6) 同日上書きマージ
	const mergedMap = new Map();

	// 既存
	historyState.forEach(entry => {
		mergedMap.set(entry.date, {
			date: entry.date,
			createdAt: entry.createdAt || new Date().toISOString(),
			values: { ...defaults(), ...entry.values },
			deltas: { ...(entry.deltas || {}) }
		});
	});

	// 取込データで同日上書き
	importedEntries.forEach(entry => {
		mergedMap.set(entry.date, entry);
	});

	// 7) 日付順ソート＋差分再計算＋最大件数制限
	historyState = sortAndRecalculateHistory(Array.from(mergedMap.values()))
		.slice(-HISTORY_LIMIT);

	// 8) 保存＆再描画
	saveHistory();
	updateHistorySelect();
	renderAll();
	renderHistoryChart();
	renderHistoryList();

	alert(`CSVを取り込みました（${historyState.length}件）`);
}

// ----------------------------------------
// file input -> FileReader
// ----------------------------------------
function handleCsvImportFile(file) {
	if (!file) return;

	const reader = new FileReader();

	reader.onload = event => {
		try {
			importCSVText(event.target.result);
		} catch (err) {
			console.error(err);
			alert(`CSVの読み込みに失敗しました: ${err.message}`);
		} finally {
			csvImportInput.value = "";
		}
	};

	reader.onerror = () => {
		alert("ファイルの読み込みに失敗しました。");
		csvImportInput.value = "";
	};

	reader.readAsText(file, "UTF-8");
}
// ----------------------------------------
// イベント登録
// ----------------------------------------
if (exportCsvBtn) {
	exportCsvBtn.addEventListener("click", exportCSV);
}

if (csvImportInput) {
	csvImportInput.addEventListener("change", e => {
		const file = e.target.files?.[0];
		handleCsvImportFile(file);
	});
}

// init
buildGrid(bossInputsEl, BOSS_METRICS);
buildGrid(extraInputsEl, EXTRA_METRICS);
wireInputs();
initMetricSelect();
updateHistorySelect();
renderHistoryList();
initCurrentFromLatestHistoryWithTodayDate();
renderAll();
renderHistoryChart();

document.getElementById("saveImageBtn").addEventListener("click", saveImage);
document.getElementById("saveHistoryBtn").addEventListener("click", () => { saveSnapshot(); alert("今回の内容を日付順で履歴保存し、差分を再計算しました。"); });
document.getElementById("clearHistoryBtn").addEventListener("click", () => { clearHistory(); alert("履歴を削除しました。"); });
document.getElementById("resetBtn").addEventListener("click", resetInputs);
document.getElementById("chartMode").addEventListener("change", () => {renderHistoryChart();});
document.getElementById("btnSNSTwitter").addEventListener("click", () => { editShareText("twitter"); });
document.getElementById("btnSNSBluesky").addEventListener("click", () => { editShareText("bluesky"); });
document.getElementById("btnSNSLine").addEventListener("click", () => { editShareText("line"); });
document.getElementById("btnCopyText").addEventListener("click", () => { editShareText("clipboard"); });
loadHistoryBtn.addEventListener("click", loadSelectedHistoryIntoForm);
historySelect.addEventListener("change", () => {renderHistoryList(); renderAll();});

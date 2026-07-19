// 武器種別
function buki_info(name, kind) {
	this.name = name;	// 武器名
	this.kind = kind;	// 武器種別
}

// クエスト情報定義
function que_info(syubetu, place, title, target, weapon=0x1FFFF, st=0, ed=0) {
	this.syubetu = syubetu;	// 種別
	this.place = place;		// 目的地、ステージ
	this.title = title;		// クエスト名称
	this.target = target;	// ターゲット
	this.weapon = weapon;	// 武器指定
	this.st = st;			// イベント開始日
	this.ed = ed;			// イベント終了日
}

var que_free = new que_info('指定なし', '', '指定なし', '');

/* グローバル変数 */
var share_txt = "";
var twitter_txt = "gaugauGames";

// ツイッターアカウントを表示する
function write_twitter(){
	var str = '<a href="https://x.com/' + twitter_txt + '">X(旧Twitter)</a>'
	let div_twi = document.getElementById('div_twi');
	div_twi.insertAdjacentHTML('afterend', str);
}

// ナビゲーションバーに表示する項目を設定
function write_navigation(){
	var str = 
		'<div align="center">※2026/6/20 Netlifyにサーバー移転しました</div>\
		<nav class="navbar fixed-bottom navbar-expand-sm navbar-dark bg-dark">\
		  <div class="container-fluid">\
	<!-- タイトル -->\
		    <a class="navbar-brand" href="./index.html">GauGau Games</a>\
		    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">\
		      <span class="navbar-toggler-icon"></span>\
		    </button>\
		    <div class="collapse navbar-collapse" id="navbarCollapse">\
		      <ul class="navbar-nav">\
	<!-- ルーレット -->\
		        <li class="nav-item dropup">\
		          <a class="nav-link dropdown-toggle" href="#" id="dropdown1" data-bs-toggle="dropdown" aria-expanded="false">ルーレット</a>\
		          <ul class="dropdown-menu" aria-labelledby="dropdown1">\
		            <li><a class="dropdown-item" href="./howto.html">使い方</a></li>\
		            <li><a class="dropdown-item" href="./mhws_roulette.html">for MHWilds</a></li>\
		            <li><a class="dropdown-item" href="./mhrise_roulette.html">for MHR:SUNBREAK</a></li>\
		            <li><a class="dropdown-item" href="./spl3_roulette.html">for スプラトゥーン3</a></li>\
		          </ul>\
		        </li>\
	<!-- その他 -->\
		        <li class="nav-item dropup">\
		          <a class="nav-link dropdown-toggle" href="#" id="dropdown11" data-bs-toggle="dropdown" aria-expanded="false">チャート</a>\
		          <ul class="dropdown-menu" aria-labelledby="dropdown11">\
		            <li><a class="dropdown-item" href="./howto_chart.html">使い方</a></li>\
		            <li><a class="dropdown-item" href="./salmon_chart.html">オオモノシャケ討伐記録</a></li>\
		          </ul>\
		        </li>\
	<!-- Link -->\
		        <li class="nav-item dropup">\
		          <a class="nav-link dropdown-toggle" href="#" id="dropdown2" data-bs-toggle="dropdown" aria-expanded="false">Link</a>\
		          <ul class="dropdown-menu" aria-labelledby="dropdown2">\
		            <li><a class="dropdown-item" target="New" href="https://www.monsterhunter.com/wilds/ja-jp/">モンハンワイルズ公式</a></li>\
		            <li><a class="dropdown-item" target="New" href="https://www.monsterhunter.com/rise-sunbreak/ja/">モンハンサンブレイク公式</a></li>\
		            <li><a class="dropdown-item" target="New" href="https://www.monsterhunter.com/ja/">モンハンポータルサイト</a></li>\
		            <li><a class="dropdown-item" target="New" href="https://gamewith.jp/mhwilds/">モンハンワイルズ攻略wiki</a></li>\
		            <li><a class="dropdown-item" target="New" href="https://gamewith.jp/mhrize/">モンハンライズ攻略wiki</a></li>\
		          </ul>\
		        </li>\
	<!-- 配信者 -->\
		        <li class="nav-item dropup">\
		          <a class="nav-link dropdown-toggle" href="#" id="dropdown3" data-bs-toggle="dropdown" aria-expanded="false">配信者</a>\
		          <ul class="dropdown-menu" aria-labelledby="dropdown3">\
		            <li><a class="dropdown-item" target="New" href="https://www.youtube.com/@ka8no">カヤノさん(大剣)</a></li>\
		            <li><a class="dropdown-item" target="New" href="https://www.youtube.com/@sakakiChannel">榊ゆうりさん(太刀)</a></li>\
		            <li><a class="dropdown-item" target="New" href="https://www.youtube.com/@shiguremito">時雨ミトさん(弓)</a></li>\
		          </ul>\
		        </li>\
	<!-- BBS(仮)\
		        <li class="nav-item">\
		          <a class="nav-link disabled" href="" tabindex="-1" aria-disabled="true">BBS</a>\
		        </li> -->\
	<!-- twitter -->\
		        <li class="nav-item">\
		          <a class="nav-link" href="https://x.com/' + twitter_txt + '" target="New">by.がうりん♂</a>\
		        </li>\
		      </ul>\
		    </div>\
		  </div>\
		</nav>'
	let div1 = document.getElementById('div1');
	div1.insertAdjacentHTML('afterend', str);
}

// ランダム値を生成
function get_random_num(len)
{
	var dd = new Date();
	var res = Math.floor(len * Math.random())
	res = (res + dd.getSeconds()) % len;

	return res;
}

// インデックスから値(16進 2byte)に変換
function idx2val(x ,y)
{
	return (x & 0x00FF)<< 8 | (y & 0x00FF);
}

// 値(16進 2byte)からインデックスに変換
function val2idx(val)
{
	this.x  = ( val >> 8) & 0x00FF;
	this.y = val & 0x00FF;
}

// 指定クエストの情報を取得
function get_quest_list(data)
{
	var idx = new val2idx(data);

	if(idx.x == 0xFE)
	{
		var rank = rank_num + 1;
		res = new que_info(rank_label[rank], '', rank_label[rank] + '：' + tokyuList[idx.y], '対象モンスターの討伐',0x2FFFF);

	}
	else if(idx.x == 0xFF)
	{
		res = que_free;
	}
	else
	{
		res = alllist[idx.x][idx.y];
	}

	return res;
}

// 指定武器のリストを作成
function make_weapon_list(weapon)
{
	var buki = new Array();
	var kind = weapon & 0xFFFF;
	var custom = weapon & 0xF0000;
	
	// 指定武器(ビット情報)から対象の武器のみリストに追加
	for (var i=0; i<weapon_list.length;i++)
	{
		if( !(kind & weapon_list[i].kind) )
		{
			continue;
		}

		if( weapon_list[i].kind & 0xF0000
			&& !(custom & weapon_list[i].kind) )
		{
			continue;
		}
		buki.push(weapon_list[i].name);
	}

	return buki;
}

//
// 共有系
//

// 結果表示の文字追加(投稿用の文字列に追加)
function add_result_txt(txt)
{
	share_txt += txt
}

// SNSに投稿する
function postResultSNS(type, blank)
{
	var tmp_txt = (share_txt ==""|blank) ? document.title + "\n" : share_txt;
	if(type != "twitter")
	{
		tmp_txt = tmp_txt + " #" + shareHashtag.replace(/\,/g," #") + "\n" + document.URL;
	}
	// パーセントエンコード変換
	tmp_txt = encodeURIComponent(tmp_txt);
	var url_txt = "";
	switch(type){
		case "twitter":	// X(旧Twitter)に投稿
			url_txt = "https://x.com/intent/tweet?hashtags=" + shareHashtag + 
						"&text="+ tmp_txt + "&url=" + document.URL;
			break;
		case "line": // LINEに共有
			url_txt = "https://line.me/R/share?text="+ tmp_txt;
			break;
		case "bluesky":	// BlueSkyに投稿
			url_txt = "https://bsky.app/intent/compose?text="+ tmp_txt;
			break;
	}
	window.open(url_txt,"_blank");
}

// クリップボードにコピー
function result_copy()
{
	var tmp_txt = (share_txt =="") ? document.title + "\n" : share_txt;
	tmp_txt = tmp_txt + " #" + shareHashtag.replace(/\,/g," #") + "\n" + document.URL;

	const textarea = document.createElement("textarea");
	textarea.value = tmp_txt;
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);

	textarea.select();
	const success = document.execCommand("copy");
	document.body.removeChild(textarea);

	alert(success ? "クリップボードに以下をコピーしました。\n-------\n"+ tmp_txt : "コピーに失敗しました");
}

function setModal()
{
	const modal = document.getElementById("imgModal");
	const modalImg = document.getElementById("imgModalContent");

	// 全サムネにイベント
	document.querySelectorAll(".howto-thumb").forEach(img => {
		img.onclick = function(){
			modal.style.display = "block";
			modalImg.src = this.src;
		};
	});

	// 閉じるボタン
	document.querySelector(".img-modal-close").onclick = function(){
		modal.style.display = "none";
	};

	// 背景クリックで閉じる
	modal.onclick = function(e){
		if (e.target === modal){
			modal.style.display = "none";
		}
	};
}
/* グローバル変数 */
var que_list = new Array();
var result_history = new Array();
var kinsi = new Array();
var history_max = 20;
var chkHistMax = 0;		// 履歴のチェック数(クエスト10個未満用)

/* クエスト選択 */
function do_quest_select(data, fixFlg=true)
{
	var saidainame = 0;
	share_txt = "";
	document.querySelector("#result").value = "";
	
	// クエスト詳細情報を表示
	do_syousai_dsp(data);

	if( !fixFlg )
	{
		// クエスト未確定ならクエスト詳細情報のみで終了
		return;
	}
	var que_tmp = get_quest_list(data);
	add_result_txt(que_tmp.title + "\n");

	// メンバーのチーム振り分け用設定
	var team_num = document.querySelector("#teamnum").selectedIndex + 1;
	var mem_num = Math.min(team_num * 4, memberlist.length);
	var mem_amari = mem_num % team_num;
	var mem_wari = Math.floor(mem_num / team_num);
	var member_tmp = new Array();
	member_tmp = member_tmp.concat(memberlist);

	// 武器のリストを作成
	var weaponbit = getTargetWeapon(que_tmp.weapon)
	var weapon_list2 = make_weapon_list(weaponbit);
	
	for(var k=0; k<team_num && member_tmp.length>0; k++)
	{
		if(team_num > 1)
		{
			add_result_txt("■チーム "+(k+1)+"\n");
		}
		else
		{
			add_result_txt("■メンバー\n");
		}
		var buki = new Array();
		buki = buki.concat(weapon_list2);

		var max = mem_wari;
		if(mem_amari > 0)
		{
			max++;
			mem_amari--;
		}
		var j = 0;

		for(var i=0;i<max;i++)
		{
			// チーム分けをランダム
			if(document.querySelector("#teamrandom").checked)
			{
				j = get_random_num(member_tmp.length);
			}
			add_result_txt(member_tmp[j]);
			member_tmp.splice(j,1);

			// 武器をランダム
			if(document.querySelector("#bukirandom").checked
			 && buki.length > 0)
			
			{
				var soubi = get_random_num(buki.length);
				add_result_txt(" ：" + buki[soubi]);
				// 武器重複させない
				if(document.querySelector("#bukibarake").checked)
				{
					buki.splice(soubi,1);
					if(buki.length == 0)
					{
						// 全部なくなったら初期化
						buki = buki.concat(weapon_list2);
					}
				}
				// サブ武器の抽選(闘技大会では除く)
				if(document.querySelector("#subweapon").checked
				 && (que_tmp.weapon & 0xFFFF) == 0xFFFF)
				{
					soubi = get_random_num(buki.length);
					add_result_txt(" / " + buki[soubi]);
					// 武器重複させない
					if(document.querySelector("#bukibarake").checked)
					{
						buki.splice(soubi,1);
						if(buki.length == 0)
						{
							// 全部なくなったら初期化
							buki = buki.concat(weapon_list2);
						}
					}
				}
			}
			add_result_txt("\n");
		}
		if(document.querySelector("#bindrandom").checked)
		{
			add_result_txt("縛り：");

			// 縛り数をランダムに決定
			var bindnum = get_random_num(document.querySelector("#saidai").selectedIndex - document.querySelector("#saisyou").selectedIndex + 1);
			bindnum += document.querySelector("#saisyou").selectedIndex;
			
			// 縛り数分の縛り内容をランダムに追加
			var bind = new Array();
			bind = bind.concat(kinsi);
			for(var i=0;i<bindnum;i++)
			{
				rand = get_random_num(bind.length);
				add_result_txt("【" + bind[rand] + "】");
				bind.splice(rand,1);
			}
			if(bindnum == 0)
			{
				add_result_txt("なし");
			}
			add_result_txt("\n");
		}
	}
	document.querySelector("#result").value = share_txt;
	add_history(data);
	setCookie();
}

// 選択したクエストの詳細を表示
function syousai_dsp()
{
	idx = document.querySelector("#siteiquest").selectedIndex;
	do_syousai_dsp(document.querySelector("#siteiquest").options[idx].value);
}

// 履歴の詳細を表示
function history_dsp()
{
	var idx = document.querySelector("#questhistory").selectedIndex;
	var data = document.querySelector("#questhistory").options[idx].value
	
	// 履歴のクエスト詳細を表示
	do_syousai_dsp(data);
	
	// 履歴内容を結果と共有文字に反映
	document.querySelector("#result").value = result_history[idx];
	share_txt = result_history[idx];
}

// クエスト詳細を表示
function do_syousai_dsp(data)
{
	var que_tmp = get_quest_list(data);
	var syousai = "";
	var idx = new val2idx(data);

	if(idx.x >= que_monster_No)
	{
		// モンスター指定、傀異討究の場合
		rank = (idx.x == 0xFE)? rank_num + 1 : rank_num;
		syousai += "<" + rank_label[rank] + "> " + que_tmp.title + "\n";
		if(que_tmp.target != ""){
			syousai += que_tmp.target + "\n";
		}
		if(que_tmp.syubetu != ""){
			syousai += que_label.syubetu + "：" + que_tmp.syubetu + "\n";
		}
		if(que_tmp.place != ""){
			syousai += que_label.place + "：" + que_tmp.place + "\n";
		}
	}
	else
	{
		syousai += "<" + que_tmp.syubetu + "> " + que_tmp.title + "\n";
		if(que_tmp.target != ""){
			syousai += que_tmp.target + "\n";
		}
		syousai += que_label.place + "：" + que_tmp.place + "\n";
	}
	// 武器に指定がある場合表示(闘技用)
	if((que_tmp.weapon & 0xFFFF) != 0xFFFF)
	{
		var weapon_tmp = make_weapon_list(que_tmp.weapon);
 		syousai += que_label.weapon + "：" + weapon_tmp.join(",") +"\n";
	}
	document.querySelector("#data").value = syousai;
}

// メンバリストを作成
function make_memberlist()
{
	memberdata = document.querySelector("#member").value;
	var listtmp = memberdata.replace(/\r/g,"");
	listtmp = listtmp.split("\n");
	var j = 0;
	var flg = false;
	num = listtmp.length;
	for(var i=0;i<num;i++)
	{
		if(listtmp[j] == "")
		{
			listtmp.splice(j,1);
			flg = true;
		}
		else
		{
			j++;
		}
	}
	memberlist = listtmp.slice(0,10);
	
	// メンバ数が10以上、または空行があったらリストを成型
	if(listtmp.length > 10 || flg)
	{
		document.querySelector("#member").value = memberlist.join("\n");
	}
}

// 縛りリストを作成
function sibari()
{
	kinsidata = document.querySelector("#bind").value;
	kinsi = kinsidata.replace(/\r/g,"");
	kinsi = kinsi.split("\n");
	var j = 0;
	var flg = false;
	num = kinsi.length;
	for(var i=0;i<num;i++)
	{
		if(kinsi[j] == "")
		{
			kinsi.splice(j,1);
			flg = true;
		}
		else
		{
			j++;
		}
	}

	// 空行があったらリストを成型
	if(flg)
	{
		document.querySelector("#bind").value = kinsi.join("\n");
	}
	setlength();
	setmin();
}

// 傀異討究リストを作成
function TrimTokyuList()
{
	var Tokyudata = document.querySelector("#KaiiTokyuList").value;
	Tokyudata = Tokyudata.replace(/\r/g,"");
	tokyuList = Tokyudata.split("\n");
	var j = 0;
	var flg = false;
	num = tokyuList.length;
	for(var i=0;i<num;i++)
	{
		if(tokyuList[j] == "")
		{
			tokyuList.splice(j,1);
			flg = true;
		}
		else
		{
			j++;
		}
	}

	// 空行があったらリストを成型
	if(flg)
	{
		document.querySelector("#KaiiTokyuList").value = tokyuList.join("\n");
	}
}

// 縛り最大数を設定
function setlength()
{
	// 縛りリスト数を最大値とする
	var max = kinsi.length + 1;
	document.querySelector("#saidai").length = max;
	for (var i=0;i<max;i++)
	{
		document.querySelector("#saidai").options[i].text = i;
	}
	if(kinsi.length > 0)
	{
		document.querySelector("#saidai").selectedIndex = 1;
	}
}

// 縛り最小リストを設定
function setmin()
{
	// 縛り最大数までを設定する
	var max = document.querySelector("#saidai").selectedIndex + 1;
	document.querySelector("#saisyou").length = max;
	for (var i=0;i<max;i++)
	{
		document.querySelector("#saisyou").options[i].text = i;
	}
}

// クエストをランダムに選択(演出あり)
function questrand()
{
	var max = 30;
	var num = 1;
	var cnt = max
	var fixFlg = false;
	
	if(document.querySelector("#EffectDisable").checked
	 || que_list.length < 2)
	{
		// 演出無効orクエスト数2件未満なら1回のみ
		fixFlg = true;
		max = 0;
	}

	do_questrand(fixFlg);
	for(var i=0; i<max; i++)
	{
		if(i > max - 8)
		{
			// 残り7回から遅くしていく
			num *= 1.4;
		}
		// タイムアウト後に実行
		setTimeout(
			function(){
				cnt--;
				if(cnt == 0)
				{
					// 最後の1回はクエスト確定
					fixFlg = true;
				}
				do_questrand(fixFlg)
			}, 
			parseInt(200 * num) );
	}
}

// クエストをランダムに選択
function do_questrand(fixFlg)
{
	var rand = 0;
	var data = 0xFFFF;

	// クエスト総数からランダム値を算出
	rand = get_random_num(que_list.length);
	data = que_list[rand];
	if(fixFlg)
	{
		// 過去最大10件で選ばれていれば調整(設定有無)
		data = chkHistory(rand);
	}
	do_quest_select(data, fixFlg);
}

// ランク、クエストのリストの選択位置を設定
function index_set(num)
{
	var idx = new val2idx(num);
	var rank = 0;
	let selrank = document.querySelector("#siteirank");
	let selquest = document.querySelector("#siteiquest");

	if(idx.x == 0xFE)
	{
		// 傀異討究
		rank = rank_num + 1;
	}
	else if(idx.x == 0xFF)
	{
		// 指定なし
		rank = rank_num + 2;
	}
	else if(idx.x >= que_monster_No)
	{
		// モンスター指定
		rank = rank_num;
	}
	else
	{
		rank = idx.x % rank_num;
	}

	for(i=0; i<selrank.length; i++)
	{
		tmp = selrank.options[i].value;
		if(rank == tmp)
		{
			selrank.selectedIndex = i;
			break;
		}
	}
	quest_set();
	for(i=0; i<selquest.length; i++)
	{
		tmp = selquest.options[i].value;
		if(num == tmp )
		{
			selquest.selectedIndex = i;
			break;
		}
	}
}

// ランクリスト設定
function rank_set(x)
{
	let selrank = document.querySelector("#siteirank");
	var opt_num = selrank.length;
	var rank = 0;

	if(x == 0xFE)
	{
		// 傀異討究
		rank = rank_num + 1;
	}
	else if(x == 0xFF)
	{
		// 指定なし
		rank = rank_num + 2;
	}
	else if(x >= que_monster_No)
	{
		// モンスター指定
		rank = rank_num;
	}
	else
	{
		rank = x % rank_num;
	}

	// 設定済みの場合中断
	for(var i=0; i<opt_num; i++)
	{
		if(selrank.options[i].value == rank)
		{
			return;
		}
	}

	selrank.length++;
	selrank.options[opt_num].text
						= rank_label[rank];
	selrank.options[opt_num].value
						= rank;
}

// クエストリスト設定
function quest_set()
{
	var opt_num = 0;
	let selrank = document.querySelector("#siteirank");
	let selquest = document.querySelector("#siteiquest");
	
	idx = selrank.selectedIndex;
	rank = selrank.options[idx].value;

	// クエストリストクリア
	selquest.length = 0;
	selquest.selectedIndex = 0;

	// 指定なし
	if(rank == rank_num + 2 )
	{
		selquest.length++;
		selquest.options[opt_num].text
								= que_free.title;
		selquest.options[opt_num++].value
								= 0xFFFF;
		return;
	}
	for(var i=0; i<que_list.length; i++)
	{
		var idx = new val2idx(que_list[i]);
		var quedata = get_quest_list(que_list[i])
		if(rank == rank_num + 1 )
		{
			// 傀異討究の場合
			if(idx.x != 0xFE)
			{
				// 討究クエスト以外スキップ
				continue;
			}
		}
		else if(rank == rank_num)
		{
			// モンスター指定の場合
			if(idx.x < que_monster_No || idx.x >= 0xFE)
			{
				// モンスター指定以外スキップ
				continue;
			}
		}
		else
		{
			// 通常の場合
			if( idx.x >= que_monster_No || rank != idx.x % rank_num )
			{
				// モンスター指定のクエスト、またはランク違いはスキップ
				continue;
			}
		}

		// 一般クエストリスト作成
		selquest.length++;
		selquest.options[opt_num].value
								= que_list[i];
		selquest.options[opt_num++].text
								= quedata.title;
	}
}

// 履歴に追加
function add_history(data)
{
	var que_tmp = get_quest_list(data);
	let quehist = document.querySelector("#questhistory");

	if(result_history.length == 0)
	{
		// 履歴初期化
		quehist.length = 0;
	}
	quehist.selectedIndex = 0;

	var len = quehist.length;
	quehist.length++;

	// 今の履歴を一つ後ろにずらす
	for( var i=len;i>0;i--)
	{
		quehist.options[i].value
			= quehist.options[i-1].value;
		quehist.options[i].text
			= quehist.options[i-1].text;
	}
	// 先頭の履歴に今回のクエストを追加
	quehist.options[0].value = data;
	quehist.options[0].text = que_tmp.title;

	// 結果内容を履歴に保存
	result_history.unshift(share_txt);
	
	// 20件を超える場合サイズを20に調整
	if(result_history.length > history_max)
	{
		quehist.length = history_max;
		result_history.length = history_max;
	}
}

// 履歴を消去
function clear_history()
{
	let quehist = document.querySelector("#questhistory");
	quehist.length = 0;
	quehist.selectedIndex = 0;
	//quehist.length++;
	//quehist.options[0].value = "";
	//quehist.options[0].text = "---";
	
	result_history.length = 0;
	chkHistMax = 0;
}

// 履歴過去最大10件に同じクエストがあるかをチェック
// 戻り値 data 調整後のクエスト番号
function chkHistory(rand)
{
	var data = que_list[rand];
	var skpQuest = new Array();

	// クエスト重複チェック無効？ or クエスト数2以下
	if( !document.querySelector("#Duplication").checked
	 || que_list.length < 2)
	{
		// 調整せずに返却
		return data;
	}

	var histnum = document.querySelector("#questhistory").length;
	var max = 10;
	if(que_list.length <= max)
	{
		// 対象クエストが10件以下の場合1～クエスト数-1が最大(最低1個前はチェック)
		max = (chkHistMax == 0)? 1 : chkHistMax;
		chkHistMax++;
		chkHistMax %= que_list.length;
	}

	if(histnum < max)
	{
		// 履歴が10件以下の場合履歴数が最大
		max = histnum;
	}
	
	var queTmp = new Array()
	queTmp = queTmp.concat(que_list);
	while(true)
	{
		var i=0;
		for(i=0; i<max; i++)
		{
			var value = document.querySelector("#questhistory").options[i].value;
			if( value == data)
			{
				// 過去重複していたらそのクエストを取り除いてランダム値を再抽選
				skpQuest.push(data);
				queTmp.splice(rand,1);
				rand = get_random_num(queTmp.length);
				data = queTmp[rand];
				break;
			}
		}
		if(i == max)
		{
			// 最後まで重複がなかったら確定
			break;
		}
	}
	if(skpQuest.length > 0)
	{
		// デバッグ用
		max = skpQuest.length;
	}
	return data;
}

// 対象クエストリストを作成
function make_questlist()
{
	// クエストリストクリア
	que_list.length = 0;
	document.querySelector("#siteirank").length = 0;
	document.querySelector("#siteirank").selectedIndex = 0;
	document.querySelector("#siteiquest").length = 0;
	document.querySelector("#siteiquest").selectedIndex = 0;

	let quechk = document.querySelectorAll("#questcheck");
	var min = 0;
	var max = quechk.length;

	// クエスト指定？
	var tmp = document.querySelector("#QuestChk").checked ? 1 : 0;		// 指定：クエスト
	tmp += document.querySelector("#MonsterChk").checked ? 2 : 0;	// 指定：モンスター

	switch (tmp)
	{
	case 0:		// なし
		max = 0;
		break;
	case 1:		// クエストのみ
		max = que_monster_No;
		break;
	case 2:		// モンスターのみ
		min = que_monster_No;
		break;
	case 3:		// クエスト＋モンスター
	default:
		break;
	}

	var total = 0;

	var today = new Date();
	var year = today.getFullYear();
	var month = today.getMonth() + 1;
	var date = today.getDate();
	var hour = today.getHours();
	var now = year * 1000000 + month * 10000 + date * 100 + hour;
	
	// 一般クエストリスト作成
	for(var i=0;i<quechk.length;i++)
	{

		var addnum = 0;
		for( var j=0; j<alllist[i].length; j++ )
		{
			// 開催期間を取得
			var st = alllist[i][j].st
			var ed = alllist[i][j].ed
			
			if( (st != 0 && now < st )
			 || (ed != 0 && now > ed ))
			{
				// 開催期間外はスキップ
				continue;
			}

			total++;
			// 最小値未満 or 最大値以上
			// or チェックがない or クエストが1件もない場合スキップ
			if(i < min || i >= max
			 || !quechk[i].checked )
			{
				continue;
			}

			// 対象のクエストをリストに追加
			var data = idx2val(i, j);
			que_list.push(data);
			addnum++;
		}
		if(addnum == 0)
		{
			// 追加したクエストが0件の場合スキップ
			continue;
		}

		// ランク設定
		rank_set(i);
	}

	// 傀異討究クエストリスト作成
	total += tokyuList.length;
	if(document.querySelector("#KaiiTokyuChk").checked)
	{
		for(var i=0;i<tokyuList.length;i++)
		{
			var data = idx2val(0xFE, i);
			que_list.push(data);
		}
		// ランク設定
		rank_set(0xFE);
	}

	// クエスト数 選択数/全件
	document.getElementById("QueNum").innerText = que_list.length + "/" + total;
	// リストが空の時指定なしデータを追加
	if(que_list.length == 0)
	{
		var idx = 0xFFFF;
		que_list.push(idx);

		// ランク設定
		rank_set(0xFF);
	}
	quest_set();
	
	// 履歴のチェック数を初期化(クエスト10個未満用)
	chkHistMax = 0;
}

// 対象武器のビット情報を取得
function getTargetWeapon(weapon)
{
	var bit = 1;
	var ret = 0xFF0000;
	var i = 1;

	while(1)
	{
		if(document.querySelector("#WeaponChk"+i) == null)
		{
			break;
		}
		if(document.querySelector("#WeaponChk"+i).checked)
		{
			ret |= bit;
		}
		bit<<=1;
		i++;
	}
	// 闘技場の指定武器で絞る
	ret &= weapon;

	return ret;
}

// 対象武器のビット情報からチェックに反映
function setTargetWeapon(weapon)
{
	var bit = 1;
	var chk = false;
	var i = 1;

	while(1)
	{
		if(document.querySelector("#WeaponChk"+i) == null)
		{
			break;
		}
		chk = (weapon & bit)? true : false;
		document.querySelector("#WeaponChk"+i).checked = chk;
		bit<<=1;
		i++;
	}
}

// 対象武器のチェックを全てON/OFFする
function allChkTargetWeapon(onoff)
{
	var chk = (onoff == 1)? true : false;
	var i = 1;

	while(1)
	{
		if(document.querySelector("#WeaponChk"+i) == null)
		{
			break;
		}
		document.querySelector("#WeaponChk"+i).checked = chk;
		i++;
	}
}

// 対象クエスト1列分を全てチェック
function allcheck(check)
{
	let quechk = document.querySelectorAll("#questcheck");

	for(var i=0;i<quechk.length;i++)
	{
		n = i % rank_num;
		if(n == check)
		{
			quechk[i].checked = true;
		}
	}
	make_questlist();
}

// 対象クエスト1列分を全てチェックを外す
function allclear(check)
{
	let quechk = document.querySelectorAll("#questcheck");

	for(var i=0;i<quechk.length;i++)
	{
		n= i % rank_num;
		if(n == check)
		{
			quechk[i].checked = false;
		}
	}
	make_questlist();
}


//
// クッキー保存、読み込み、初期化
//

// 設定をクッキーに保存
function setCookie()
{
	var expires = new Date();
	expires.setTime(expires.getTime() + (30*24*60*60*1000));

	/* メンバー */
	document.cookie = mh_title + "_quemember=" + escape(document.querySelector("#member").value) + "; expires=" + expires.toGMTString();

	/* 縛り */
	document.cookie = mh_title + "_bindrandom=" + escape(document.querySelector("#bind").value) + "; expires=" + expires.toGMTString();

	/* 条件 */
	cond = new Array();
	cond[0] = document.querySelector("#bukirandom").checked ? 1 : 0;	// 武器ランダム
	cond[1] = document.querySelector("#bukibarake").checked ? 1 : 0;	// 武器重複なし
	cond[2] = document.querySelector("#subweapon").checked ? 1 : 0;		// サブ武器を含める
	cond[3] = document.querySelector("#teamnum").selectedIndex;			// チーム数
	cond[4] = document.querySelector("#teamrandom").checked ? 1 : 0;	// チームをランダム
	cond[5] = document.querySelector("#bindrandom").checked ? 1 : 0;	// 縛りを付加
	cond[6] = document.querySelector("#saidai").selectedIndex;			// 縛り最大
	cond[7] = document.querySelector("#saisyou").selectedIndex;			// 縛り最小
	cond[8] = document.querySelector("#EffectDisable").checked ? 1 : 0;	// 演出無効
	cond[9] = document.querySelector("#Duplication").checked ? 1 : 0;	// クエスト過去最大10件被らなくする
	cond[10] = document.querySelector("#QuestChk").checked ? 1 : 0;;	// 指定：クエスト
	cond[10] += document.querySelector("#MonsterChk").checked ? 2 : 0;;	// 指定：モンスター
	cond[11] = document.querySelector("#KaiiTokyuChk").checked ? 1 : 0;	// 指定：傀異討究
	cond[12] = getTargetWeapon(0xFFFF);									// 対象武器ビット情報
	
	document.cookie = mh_title + "_condition=" + escape(cond.join(",")) + "; expires=" + expires.toGMTString();

	/* 対象クエスト */
	let quechk = document.querySelectorAll("#questcheck");
	boxlength = quechk.length;
	check = new Array();
	for(i=0; i<boxlength; i++)
	{
		check[i] = quechk[i].checked ? 1 : 0;
	}
	document.cookie = mh_title + "_check=" + escape(check.join(",")) + "; expires=" + expires.toGMTString();

	/* 傀異討究リスト */
	document.cookie = mh_title + "_TokyuList=" + escape(document.querySelector("#KaiiTokyuList").value) + "; expires=" + expires.toGMTString();
}

// クッキーから設定を更新 なければ初期値設定
// init = 1 :初期値を設定(初期化)
function getCookie(init)
{
	/* メンバー */
	var tmp = (document.cookie + ";").match(mh_title+"_quemember=([^;]*);");
	document.querySelector("#member").value = 
			(tmp != null && init == 0) ? unescape(tmp[1]) : def_member;
	make_memberlist();

	/* 縛り */
	tmp = (document.cookie + ";").match(mh_title + "_bindrandom=([^;]*);");
	document.querySelector("#bind").value = 
			(tmp != null && init == 0) ? unescape(tmp[1]) : def_bind;
	sibari();
	
	/* 条件 */
	var tmp = (document.cookie+";").match(mh_title+"_condition"+"=([^;]*);");
	cond = new Array();
	cond = (tmp != null && init == 0) ? unescape(tmp[1]).split(",") : def_cond;
	
	// 条件設定追加分を補填
	if(cond.length < def_cond.length)
	{
		for(var i=cond.length; i<def_cond.length; i++)
		{
			cond.push(def_cond[i]);
		}
	}

	document.querySelector("#bukirandom").checked = (cond[0]==1);	// 武器ランダム
	document.querySelector("#bukibarake").checked = (cond[1]==1);	// 武器重複なし
	document.querySelector("#subweapon").checked = (cond[2]==1);	// サブ武器を含める
	document.querySelector("#teamnum").selectedIndex = cond[3];		// チーム数
	document.querySelector("#teamrandom").checked = (cond[4]==1);	// チームをランダム
	document.querySelector("#bindrandom").checked = (cond[5]==1);	// 縛りを付加
	document.querySelector("#saidai").selectedIndex = cond[6];		// 縛り最大
	setmin()
	document.querySelector("#saisyou").selectedIndex = cond[7];		// 縛り最小
	document.querySelector("#EffectDisable").checked = (cond[8]==1);// 演出無効
	document.querySelector("#Duplication").checked = (cond[9]==1);	// クエスト過去最大10件被らなくする
	document.querySelector("#QuestChk").checked = (cond[10] & 1);	// 指定：クエスト
	document.querySelector("#MonsterChk").checked = (cond[10] & 2);	// 指定：モンスター
	document.querySelector("#KaiiTokyuChk").checked = (cond[11]==1);// 指定：傀異討究
	setTargetWeapon(cond[12]);										// 対象武器ビット情報

	/* 対象クエスト */
	var tmp = (document.cookie + ";").match(mh_title + "_check=([^;]*);");
	box = new Array();
	box = (tmp != null && init == 0) ? unescape(tmp[1]).split(",") : def_questchk;
	let quechk = document.querySelectorAll("#questcheck");
	boxlength = quechk.length;

	// クエスト追加分を補填
	//if(box.length < boxlength)
	//{
	//	for(var i=box.length; i<def_questchk.length; i++)
	//	{
	//		box.push(def_questchk[i]);
	//	}
	//}
	// クエスト数不一致の場合デフォルト設定
	if(box.length != boxlength)
	{
		box = def_questchk;
	}
	for(i=0; i<boxlength; i++)
	{
		quechk[i].checked = box[i] == 1 ? true: false;
	}
	/* 傀異討究リスト */
	tmp = (document.cookie + ";").match(mh_title + "_TokyuList=([^;]*);");
	document.querySelector("#KaiiTokyuList").value = 
			(tmp != null && init == 0) ? unescape(tmp[1]) : def_tokyu;
	TrimTokyuList();

	make_questlist();
}

const express = require('express');
const mysql = require('mysql');
const crypto = require('crypto');
const session = require('express-session');
const request = require('request');
const path=require('path');
const convert=require('xml-js');

const db_infor=require("../infor/db_infor.json");
const volunteer_infor=require("../infor/volunteer_infor.json");

var conn = mysql.createConnection({
    host : db_infor.host,  
    user : db_infor.user,
    password : db_infor.password,
    database : db_infor.database
});
conn.connect();

const app = express();
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}));

app.get('/',(req,res)=>{
    res.sendFile('logintree.html',{root:'../public/HTML/'});
});//메인페이지로딩

//로그인 관련
app.post('/loginCheck', (req, res) => {
    console.log(req.session)
   if(req.session.userid&&req.session.username) {
       res.send({"logged":true,"name":req.session.username});
   }
   else{
        res.send({"logged":false});
   }
});//로그인 체크
app.post('/login',(req,res)=>{
    var id=req.body.id;
    conn.query("select name,salt,password from tree_user where id=?",[id],(err,result)=>{
        if(result.length==0){
            console.log(req.body);
            console.log("로그인 실패(id 틀림)");
            res.send({"login":"입력하신 아이디가 존재하지 않습니다"});
        }
        else{
            var salt=result[0].salt;
            var pw=result[0].password
            crypto.pbkdf2(req.body.password,salt,100000,64,'sha512',(err,key)=>{
                conn.query("select name from tree_user where password=? and id=?",[key.toString('base64'),id],(err,result)=>{
                    if(result.length==0){
                        console.log("로그인 실패(password 틀림)");
                        res.send({"login":"패스워드가 일치하지 않습니다"});
                    }
                    else if(pw===key.toString('base64')){   
                        req.session.username=result[0].name;
                        req.session.userid=id;
                        res.send({"login":"로그인 완료"});
                    }
                });
            });
        }
    });
});//로그인
app.post('/register',(req,res)=>{
    crypto.randomBytes(64, (err, buf) => {
        crypto.pbkdf2(req.body.password, buf.toString('base64'), 100000, 64, 'sha512', (err, key) => {
          console.log(key.toString('base64'));
          var pass=key.toString('base64'),salt=buf.toString('base64');
          conn.query('insert into tree_user(id,password,name,salt) values(?,?,?,?)',[req.body.id,pass,req.body.name,salt],(err,result)=>{
              if(err){
                  res.send({"complete":false});
              }
              else{
                res.send({"complete":true});
              }
          });
        });
    });
});//회원 가입 (이름 4글자)
app.post('/logout',(req,res)=>{
    req.session.destroy(error=>{if(error)console.log(error);})
    res.send({"message":"로그아웃 되셨습니다"});
});//로그아웃

//봉사 관련
app.post('/participate',(req,res)=>{
    var v_id=req.body.volunteer_id;
    if(req.session.userid){
        conn.query('select * from participate_volunteer where id=? and volunteer_id=?',[req.session.userid,v_id],(err,result)=>{
            if(result.length==0){
                conn.query('insert into participate_volunteer(id,volunteer_id,volunteer_title) value(?,?,?)',[req.session.userid,v_id,req.body.volunteer_name]);
                res.send({"participate":"참가되었습니다"});
            }
            else{
                res.send({"participate":"이미 신청한 봉사 입니다"});
            }
        });
    }
    else{
        res.send({"participate":"로그인 되지 않았습니다"});
    }
});//봉사 참가
app.post('/wirtevolunteerdiary',(req,res)=>{
    var user_id=req.session.userid,v_id=req.body.volunteer_id;
    var title=req.body.title,content=req.body.content;
    var b_hour=req.body.begin_hour,e_hour=req.body.end_hour;
    if(req.session.userid){
        conn.query('select *from volunteer_diary where id=? and volunteer_id=?',[req.session.userid,req.body.volunteer_id],(err,result)=>{//중복되는 일지 작성인지 검사
            if(result.length==0){
                conn.query('select * from participate_volunteer where id=? and volunteer_id=?',[user_id,v_id],(err,result)=>{//일지에 작성할려는 봉사가 신청한 봉사인지 
                    if(result.length!=0){
                        conn.query('delete from participate_volunteer where id=? and volunteer_id=?',[user_id,v_id]);//신청봉사 삭제
                        conn.query('insert into volunteer_diary(id,volunteer_id,title,content,begin_hour,end_hour) value(?,?,?,?,?,?)',[user_id,v_id,title,content,b_hour,e_hour]);//일지 DB에 저장
                        conn.query('update tree_user set volunteer_cnt=volunteer_cnt+1,volunteer_hour=volunteer_hour+?,fruit=fruit+? where id=?',[e_hour-b_hour,e_hour-b_hour,user_id]);
                        res.send({"volunteer_diary":"작성완료 되었습니다"});
                    }
                    else{
                        res.send({"volunteer_diary":"신청하지 않은 봉사입니다"});
                    }
                });
            }
            else{
                res.send({"volunteer_diary":"중복 일지 작성입니다"});
            }

        });
    }
    else{
        res.send({"volunteer_diary":"로그인 먼저 해주세요"})
    }
});//봉사 일지 작성

//조회
app.get('/volunteerTier',(req,res)=>{
    if(req.session.userid&&req.session.username){
        conn.query("select volunteer_hour from tree_user where id=?",[req.session.userid],(err,result)=>{
            var tier;
            if(result[0].volunteer_hour==0){
                tier="unrank";
            }
            else if(result[0].volunteer_hour<=3){
            tier="bronze4";
            }
            else if(result[0].volunteer_hour<=5){
                tier="bronze3";
            }
            else if(result[0].volunteer_hour<=7){
                tier="bronze2";
            }
            else if(result[0].volunteer_hour<=9){
                tier="bronze1";
            }
            else if(result[0].volunteer_hour<=11){
                tier="silver4";
            }
            else if(result[0].volunteer_hour<=14){
                tier="silver3";
            }
            else if(result[0].volunteer_hour<=17){
                tier="silver2";
            }
            else if(result[0].volunteer_hour<=20){
                tier="silver1";
            }
            else if(result[0].volunteer_hour<=24){
                tier="gold4";
            }
            else if(result[0].volunteer_hour<=28){
                tier="gold3";
            }
            else if(result[0].volunteer_hour<=32){
                tier="gold2";
            }
            else if(result[0].volunteer_hour<=36){
                tier="gold1";
            }
            else if(result[0].volunteer_hour<=41){
                tier="platinum4";
            }
            else if(result[0].volunteer_hour<=46){
                tier="platinum3";
            }
            else if(result[0].volunteer_hour<=51){
                tier="platinum2";
            }
            else if(result[0].volunteer_hour<=56){
                tier="platinum1";
            }
            else if(result[0].volunteer_hour<=62){
                tier="diamond4";
            }
            else if(result[0].volunteer_hour<=68){
                tier="diamond3";
            }
            else if(result[0].volunteer_hour<=74){
                tier="diamond2";
            }
            else if(result[0].volunteer_hour<=80){
                tier="diamond1";
            }
            else if(result[0].volunteer_hour<=87){
                tier="master4";
            }
            else if(result[0].volunteer_hour<=94){
                tier="master3";
            }
            else if(result[0].volunteer_hour<=101){
                tier="master2";
            }
            else if(result[0].volunteer_hour<=108){
                tier="master1";
            }
            else if(result[0].volunteer_hour<=116){
                tier="grandmaster4";
            }
            else if(result[0].volunteer_hour<=124){
                tier="grandmaster3";
            }
            else if(result[0].volunteer_hour<=132){
                tier="grandmaster2";
            }
            else if(result[0].volunteer_hour<=140){
                tier="grandmaster1";
            }
            else if(result[0].volunteer_hour<=149){
                tier="challenger4";
            }
            else if(result[0].volunteer_hour<=158){
                tier="challenger3";
            }
            else if(result[0].volunteer_hour<=167){
                tier="challenger2";
            }
            else {
                tier="challenger1";
            }
            res.send({"tree_tier":tier});
        });
    }
    else{
        res.send("로그인 먼저하세여");
    }
});//유저의 트리(티어) 조회
app.get('/volunteer_list',(req,res)=>{
    var arr=[];
    var date=new Date(),str;
    var year=date.getFullYear();
    var month=date.getMonth()<10?("0"+(date.getMonth()+1)):String(date.getMonth()+1);
    var day=date.getDate()<10?("0"+(date.getDate())):String(date.getDate());
    str=Number(year+month+day);
    conn.query('select * from volunteer_list;',[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            if(result[i].end_date<str){
                continue;
            }
            arr.push(result[i]);
        }
        res.send(arr);
    });
});//봉사 목록 조회
app.get('/getParticipate',(req,res)=>{
    var arr=[];
    conn.query('select * from participate_volunteer where id=?',[req.session.userid],(err,result)=>{
        if(result.length==0){
            res.send("참가한 봉사가 없습니다");
        }
        else{
            for(var i=0;i<result.length;i++){
                arr.push(result[i]);
            }
            res.send(arr);
        }
    });
});//봉사 참가 목록 조회

//기타
app.get('/mypage',(req,res)=>{
    conn.query('select * from tree_user where id=?',[req.session.userid],(err,result)=>{
        res.send({
            "name":req.session.username,
            "fruit":result[0].fruit,
            "volunteer_cnt":result[0].volunteer_cnt,
            "volunteer_hour":result[0].volunteer_hour
        });
    });
});//마이페이지를 구성하는데 필요한 정보를 보내준다
app.post('/order',(req,res)=>{
    if(req.session.userid){
        conn.query('select * from tree_user where id=?',[req.session.userid],(err,result)=>{
            if(req.body.fruit<=result[0].fruit){
                conn.query("insert into product_order(id,item,address) value(?,?,?)",[req.session.userid,req.body.item,req.body.address]);
                conn.query("update tree_user set fruit = fruit-? where id=?",[req.body.fruit,req.session.userid]);
                res.send({"order":"주문이 완료되었습니다"});  
            }
            else{
                res.send({"order":"주문 열매가 부족합니다"});
            }
        });
    }
    else{
        res.send({"order":"로그인이 되지 않았습니다"});
    }
});//포인트로 주문기능
app.get('/ranking',(req,res)=>{
    var arr=[];
    conn.query('select * from tree_user order by volunteer_hour desc',[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            arr.push({"name":result[i].name,"volunteer_hour":result[i].volunteer_hour,"volunteer_cnt":result[i].volunteer_cnt});
        }
        res.send(arr);
    });
});//랭킹
app.get('/myranking',(req,res)=>{
    if(req.session.userid){
        conn.query('select * from tree_user order by volunteer_hour desc',[],(err,result)=>{
            for(let i=0;i<result.length;i++){
                if(result[i].id==req.session.userid){
                    res.send({"rank":i+1,"name":result[i].name,"volunteer_hour":result[i].volunteer_hour,"volunteer_cnt":result[i].volunteer_cnt});
                }
            }
        });
    }
    else{
        res.send(false);
    }
});//나의 순위가 담긴 랭킹

setTimeout(()=>{
    var url='http://openapi.1365.go.kr/openapi/service/rest/VolunteerPartcptnService/getVltrCategoryList';//행정 안전부 open api
    url+='?'+encodeURIComponent('ServiceKey')+'='+volunteer_infor.serviceKey;
    url+='&'+encodeURIComponent('UpperClCode')+'='+encodeURIComponent('0800');
    var result;
    request({
        url:url,
        method:"GET"
    },(err,ress,body)=>{
        result=body;
        result=convert.xml2json(result, {compact: true, spaces: 4,strict: false});
        var json=JSON.parse(result).response.body;
        for(let a of json.items.item){
            conn.query('select * from volunteer_list where volunteer_id=?',[a.progrmRegistNo._text],(err,result)=>{
                if(result.length==0){//봉사 ID로 조회하고 조회한 봉사ID가 없으면 새로 DB에 추가
                    conn.query('insert into volunteer_list value(?,?,?,?,?)',[a.progrmRegistNo._text,a.progrmSj._text,a.nanmmbyNm._text,a.progrmBgnde._text,a.progrmEndde._text]);
                }
            });
        }
    });//봉사를 가져옴
},0);//서버가 켜지면 봉사 정보를 바로 가져옴
setInterval(()=>{
    var url='http://openapi.1365.go.kr/openapi/service/rest/VolunteerPartcptnService/getVltrCategoryList';//행정 안전부 open api
    url+='?'+encodeURIComponent('ServiceKey')+'='+volunteer_infor.serviceKey;
    url+='&'+encodeURIComponent('UpperClCode')+'='+encodeURIComponent('0800');
    var result;
    request({
        url:url,
        method:"GET"
    },(err,ress,body)=>{
        result=body;
        result=convert.xml2json(result, {compact: true, spaces: 4,strict: false});
        var json=JSON.parse(result).response.body;
        for(let a of json.items.item){
            conn.query('select * from volunteer_list where volunteer_id=?',[a.progrmRegistNo._text],(err,result)=>{
                if(result.length==0){
                    conn.query('insert into volunteer_list value(?,?,?,?,?)',[a.progrmRegistNo._text,a.progrmSj._text,a.nanmmbyNm._text,a.progrmBgnde._text,a.progrmEndde._text]);
                }
            });
        }
    });//봉사를 가져옴
},43200000)//24시간(86400000ms)마다 봉사 데이터를 가져오면서 기한이 지난 봉사 삭제

app.listen(3000, console.log('Server running on Port 3000'));
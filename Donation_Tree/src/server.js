const express = require('express');
const mysql = require('mysql');
const crypto = require('crypto');
const session = require('express-session');
const request = require('request');
const path=require('path');
const convert=require('xml-js');
const nodemailer=require('nodemailer');

const db_infor=require("../infor/db_infor.json");
const volunteer_infor=require("../infor/volunteer_infor.json");
const mail_infor=require("../infor/mail_infor.json");

var conn = mysql.createConnection({
    host : db_infor.host,  
    user : db_infor.user,
    password : db_infor.password,
    database : db_infor.database
});
conn.connect();
let transport=nodemailer.createTransport({
    service:"gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: mail_infor.user,
      pass: mail_infor.pass,
    },
});
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
          var pass=key.toString('base64'),salt=buf.toString('base64');
          conn.query('insert into tree_user(id,password,name,mail,salt) values(?,?,?,?,?)',[req.body.id,pass,req.body.name,req.body.mail,salt],(err,result)=>{
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

//계정 복구
app.post('/user/find/Id',(req,res)=>{
    conn.query("select * from tree_user where name=?",[req.body.name],(err,result)=>{
        if(result.length==0){
            res.send({"result":"등록된 이름이 없습니다"});
        }
        conn.query("select * from tree_user where mail=? and name=?",[req.body.mail,req.body.name],(err,result)=>{
            if(result.length==0){
                res.send({"result":"메일이 일치하지 않습니다"});
            }
            else{
                find_id(result,req.body.mail);
                res.send({"result":"메일이 전송되었습니다"});
            }
        });
    });
});//ID 찾기
async function find_id(result,mail){
    let infor= await transport.sendMail({
        from:`"Voluntree_team"<${mail_infor.user}>`,
        to:mail,
        subject:"voluntree ID 찾기",
        text:result[0].id,
        html: `<b>아이디:${result[0].id}</b>`,
    });
}//ID찾기 위한 메일보내는 함수
app.post('/user/change/Password/auth',(req,res)=>{
    conn.query("select * from tree_user where id=? and mail=?",[req.body.id,req.body.mail],(err,result)=>{
        if(result.length==0){
            res.send({"result":false});
        }
        else{
            res.send({"result":true});
        }
    })
});//비번찾기위한 사용자 인증
app.put('/user/change/Password',(req,res)=>{
    conn.query("select * from tree_user where id=?",[req.body.id],(err,result)=>{
        crypto.pbkdf2(req.body.password,result[0].salt, 100000, 64, 'sha512',(err,key)=>{
            var password=key.toString('base64');
            conn.query("update tree_user set password=? where id=?",[password,req.body.id]);
            res.send({"result":"변경 되었습니다"});
        });
    });
});//비밀번호 바꾸기

//봉사 관련
app.post('/volunteer/participate',(req,res)=>{
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
});//봉사 신청
app.post('/volunteer/diary',(req,res)=>{
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
app.get('/volunteer/diary/all',(req,res)=>{
    if(req.session.userid){
        conn.query("select * from volunteer_diary where id=?",[req.session.userid],(err,result)=>{
            var arr=[];
            for(let i=0;i<result.length;i++){
                arr.push({"num":i+1,"title":result[i].title,"content":result[i].content,"volunteer_id":result[i].volunteer_id});
            }
            res.send(arr);
        });    
    }
    else{
        res.send("로그인 먼저 해주세요");
    }
});//모든 자신의 봉사일지 가져오기
app.get('/volunteer/diary/details',(req,res)=>{
    if(req.session.userid){
        conn.query("select * from volunteer_diary where id=? and volunteer_id=?",[req.session.userid,req.body.volunteer_id],(err,result)=>{
            if(result.length==0){
                res.send({"result":"조회된 일지가 없습니다"});
            }
            else{
                var rs=result;
                conn.query("select name from tree_user where id=?",[result[0].id],(err,result)=>{
                    var user_name=result[0].name;
                    res.send({"result":{"author":user_name,"volunteer_id":rs[0].volunteer_id,"title":rs[0].title,"content":rs[0].content,"begin_hour":rs[0].begin_hour,"end_hour":rs[0].end_hour}});
                });
            }
        });
    }
    else{
        res.send({"result":"로그인 먼저 해주세요"});
    }
});//봉사 일지 상세보기

//조회
app.get('/volunteer/Tier',(req,res)=>{
    if(req.session.userid&&req.session.username){
        conn.query("select volunteer_hour from tree_user where id=?",[req.session.userid],(err,result)=>{
            var tier;
            if(result[0].volunteer_hour==0){
                tier="unrank";
            }
            else if(result[0].volunteer_hour<=3){
            tier="../src/public/img/단풍/씨앗";
            }
            else if(result[0].volunteer_hour<=5){
                tier="../src/public/img/단풍/새싹";
            }
            else if(result[0].volunteer_hour<=7){
                tier="../src/public/img/단풍/줄기";
            }
            else if(result[0].volunteer_hour<=9){
                tier="../src/public/img/단풍/나무";
            }
            else if(result[0].volunteer_hour<=11){
                tier="../src/public/img/대나무/씨앗";
            }
            else if(result[0].volunteer_hour<=14){
                tier="../src/public/img/대나무/새싹";
            }
            else if(result[0].volunteer_hour<=17){
                tier="../src/public/img/대나무/줄기";
            }
            else if(result[0].volunteer_hour<=20){
                tier="../src/public/img/대나무/나무";
            }
            else if(result[0].volunteer_hour<=24){
                tier="../src/public/img/바오밥/씨앗";
            }
            else if(result[0].volunteer_hour<=28){
                tier="../src/public/img/바오밥/새싹";
            }
            else if(result[0].volunteer_hour<=32){
                tier="../src/public/img/바오밥/줄기";
            }
            else if(result[0].volunteer_hour<=36){
                tier="../src/public/img/바오밥/나무";
            }
            else if(result[0].volunteer_hour<=41){
                tier="../src/public/img/벚꽃/씨앗";
            }
            else if(result[0].volunteer_hour<=46){
                tier="../src/public/img/벚꽃/새싹";
            }
            else if(result[0].volunteer_hour<=51){
                tier="../src/public/img/벚꽃/줄기";
            }
            else if(result[0].volunteer_hour<=56){
                tier="../src/public/img/벚꽃/나무";
            }
            else if(result[0].volunteer_hour<=62){
                tier="../src/public/img/소나무/씨앗";
            }
            else if(result[0].volunteer_hour<=68){
                tier="../src/public/img/소나무/새싹";
            }
            else if(result[0].volunteer_hour<=74){
                tier="../src/public/img/소나무/줄기";
            }
            else if(result[0].volunteer_hour<=80){
                tier="../src/public/img/소나무/나무";
            }
            else if(result[0].volunteer_hour<=87){
                tier="../src/public/img/야자/씨앗";
            }
            else if(result[0].volunteer_hour<=94){
                tier="../src/public/img/야자/새싹";
            }
            else if(result[0].volunteer_hour<=101){
                tier="../src/public/img/야자/줄기";
            }
            else if(result[0].volunteer_hour<=108){
                tier="../src/public/img/야자/나무";
            }
            else if(result[0].volunteer_hour<=116){
                tier="../src/public/img/은행/씨앗";
            }
            else if(result[0].volunteer_hour<=124){
                tier="../src/public/img/은행/새싹";
            }
            else if(result[0].volunteer_hour<=132){
                tier="../src/public/img/은행/줄기";
            }
            else if(result[0].volunteer_hour<=140){
                tier="../src/public/img/은행/나무";
            }
            else if(result[0].volunteer_hour<=149){
                tier="../src/public/img/플라타너스/씨앗";
            }
            else if(result[0].volunteer_hour<=158){
                tier="../src/public/img/플라타너스/새싹";
            }
            else if(result[0].volunteer_hour<=167){
                tier="../src/public/img/플라타너스/줄기";
            }
            else {
                tier="../src/public/img/플라타너스/나무";
            }
            res.send({"tree_tier":tier});
        });
    }
    else{
        res.send("로그인 먼저하세여");
    }
});//유저의 트리(티어) 조회
app.get('/volunteer/list',(req,res)=>{
    var arr=[];
    var date=new Date(),str;
    var year=date.getFullYear();
    var month=date.getMonth()+1<10?("0"+(date.getMonth()+1)):String(date.getMonth()+1);
    var day=date.getDate()<10?("0"+(date.getDate())):String(date.getDate());
    str=Number(year+month+day);
    conn.query('select * from volunteer_list',[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            if(result[i].end_date<str){
                continue;
            }
            arr.push(result[i]);
        }
        res.send(arr);
    });
});//봉사 목록 조회
app.get('/Participate',(req,res)=>{
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
app.get('/ranking',(req,res)=>{
    var arr=[];
    conn.query('select * from tree_user order by volunteer_hour desc',[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            arr.push({"rank":i+1,"name":result[i].name,"volunteer_hour":result[i].volunteer_hour,"volunteer_cnt":result[i].volunteer_cnt});
        }
        res.send(arr);
    });
});//랭킹
app.get('/ranking/my',(req,res)=>{
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
app.get('/tree/count',(req,res)=>{
    conn.query('select count(*) as count from tree_user',[],(err,result)=>{
        res.send({"result":result[0].count});
    });
});//트리의 수

//상품 주문
app.post('/order',(req,res)=>{
    if(req.session.userid){
        conn.query('select * from tree_user where id=?',[req.session.userid],(err,result)=>{
            var user=result[0];
            conn.query('select * from product where name=?',[req.body.item_name],(err,result)=>{
                if(result[0].fruit<=user.fruit){
                    conn.query("insert into product_order(id,item,address) value(?,?,?)",[req.session.userid,result[0].name,req.body.address]);
                    conn.query("update tree_user set fruit = fruit-? where id=?",[result[0].fruit,req.session.userid]);
                    res.send({"order":"주문이 완료되었습니다"});  
                }
                else{
                    res.send({"order":"주문하기위한 열매가 부족합니다"});
                }
            });
        });
    }
    else{
        res.send({"order":"로그인이 되지 않았습니다"});
    }
});//포인트로 주문기능
app.get('/order/my',(req,res)=>{
    var arr=[];
    if(req.session.userid){
        conn.query('select * from product_order where id=?',[req.session.userid],(err,result)=>{
            for(let i=0;i<result.length;i++){
                arr.push({"item_name":result[i].item,"address":result[i].address,"status":result[i].status});
            }
            res.send(arr);
        });
    }
    else{
        res.send(arr);
    }
});//내가 했던 주문 조회

//쇼핑
app.get('/shop/energy',(req,res)=>{
    var arr=[];
    conn.query("select * from product where type='에너지'",[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            arr.push({"name":result[i].name,"fruit":result[i].fruit,"img":result[i].img});
        }
        res.send(arr);
    });
});//에너지 상품만 조회
app.get('/shop/enviroment',(req,res)=>{
    var arr=[];
    conn.query("select * from product where type='친환경'",[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            arr.push({"name":result[i].name,"fruit":result[i].fruit,"img":result[i].img});
        }
        res.send(arr);
    });
});//친환경 상품만 조회
app.get('/shop',(req,res)=>{
    var arr=[];
    conn.query("select * from product",[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            arr.push({"name":result[i].name,"fruit":result[i].fruit,"img":result[i].img});
        }
        res.send(arr);
    });
});//모든 상품 조회
app.get('/shop/about',(req,res)=>{
    conn.query('select * from product where name=?',[req.body.product_name],(err,result)=>{
        res.send({"name":result[0].name,"fruit":result[0].fruit,"img":result[0].img,"description":result[0].description});
    });
});//상품 상세설명
app.post('/shop/insert',(req,res)=>{
    var name=req.body.name;
    var fruit=req.body.fruit;
    var type=req.body.type;
    var img=req.body.img;
    var description=req.body.description;
    conn.query("insert into product(name,fruit,type,img,description) value(?,?,?,?,?)",[name,fruit,type,img,description],(err,result)=>{
      if(err){
        console.log(err);
        res.send({"product":false});
      }  
      else{
        res.send({"product":true});
      }
    });
});//상품 추가

setTimeout(()=>{
    var now=new Date();
    console.log(now.getHours()+":"+now.getMinutes());
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
    var now=new Date();
    console.log(now.getHours()+":"+now.getMinutes());
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
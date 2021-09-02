const express = require('express');
var mysql = require('mysql');
const crypto = require('crypto');
const session = require('express-session');
const multer = require('multer');
const path='../';

const db_infor=require("../infor/db_infor.json");
const storage = multer.diskStorage({
    destination: "./public/img/",
    filename: function(req, file, cb) {
      cb(null, "imgfile" + Date.now() + path.extname(file.originalname));
    }
  });
const { request } = require('http');

var conn = mysql.createConnection({
    host : db_infor.host,  
    user : db_infor.user,
    password : db_infor.password,
    database : db_infor.database
});
conn.connect();

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}));

app.get('/',(req,res)=>{
    res.sendFile('main.html',{root:'../public/html/'});
});//메인페이지로딩

app.post('/loginCheck', (req, res) => {
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

/*app.post("/upload", storage.single("selectImg"), (req, res) => {
    console.log(req.file);
    res.send({
        fileName: req.file.filename
    });
});//웹페이지랑 연결되야 테스트 할 수 있을듯*/

app.get('/volunteerTier',(req,res)=>{
    if(req.session.userid&&req.session.username){
        conn.query("select volunteer_hour from tree_user where id=?",[req.session.userid],(err,result)=>{
            var tier;
            if(result[0].volunteer_hour<=3){
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
});//유저의 트리(티어)를 보여주는 요청
app.get('/volunteer_list',(req,res)=>{
    var arr=[];
    conn.query('select * from volunteer_list;',[],(err,result)=>{
        for(let i=0;i<result.length;i++){
            arr.push(result[i]);
        }
        res.send(arr);
    });
});//봉사 목록들을 보내줌
app.get('/mypage',(req,res)=>{
    conn.query('select volunteer_cnt,volunteer_hour from tree_user where id=?',[req.session.userid],(err,result)=>{
        res.send({
            "name":req.session.username,
            "volunteer_cnt":result[0].volunteer_cnt,
            "volunteer_hour":result[0].volunteer_hour
        });
    });
});//마이페이지를 구성하는데 필요한 정보를 보내준다

//------------------------------------------------------------------페이지 요청---------------------------------------------------------

app.post('/getMypage',(req,res)=>{
    res.sendFile('mypage.html',{root:"../public/html/"});
});
app.post('/getLogin',(req,res)=>{
    res.sendFile('login.html',{root:'../public/html/'})
});
app.post('/getList',(req,res)=>{
    res.sendFile('list.html',{root:'../public/html/'})
});

app.listen(3000, console.log('Server running on Port 3000'));
/*function getUser() {
        
    const config = {
      method: "get"
    };
    
    fetch("/login", config)
      .then(response => response.json())
      .then(data => console.log(data))
      .catch(error => console.log(error));
  }

 jQuery.fn.serializeObject = function() { 
  var obj = null; 
  try { 
      if(this[0].tagName && this[0].tagName.toUpperCase() == "FORM" ) { 
          var arr = this.serializeArray(); 
          if(arr){ obj = {}; 
          jQuery.each(arr, function() { 
              obj[this.name] = this.value; }); 
          } 
      } 
  }catch(e) { 
      alert(e.message); 
  }finally {} 
  return obj; 
}

function to_ajax(){


    const serializedValues2 = $('#loginForm').serializeObject()

    $.ajax({
        type : 'post',
        url : '/login',
        data : JSON.stringify(serializedValues2),
        dataType : 'json',
        error: function(xhr, status, error){
            alert(error);
        },
        success : function(json){
            alert(json)
        },
    });
}*/

$(function (){
    $("#lgbtn").click(login);
});
function login(){
    let id=$('.id').val();
    let pw=$('.pw').val();
    $.ajax({
        type:'post',
        url:'/login',
        data:"id="+id+'&'+'password='+pw,
        dataType:'application/json',
        succes:(data)=>{
            console.log(data);
        },
        error:()=>{
            console.log("error");
        }
    });
    console.log(id,pw);
}
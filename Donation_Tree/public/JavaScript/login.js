function getUser() {
        
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
}
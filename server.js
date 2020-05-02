const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', ' * ');
    next();
  });
  app.get('/map.html', function(req, res){
    res.sendFile(__dirname + '/map.html');
  });

//server cassandra communication
var cassandra = require("cassandra-driver");

var dbConfig = {
         contactPoints : ['127.0.0.1'],
         keyspace:'traffic_data',
         localDataCenter: 'datacenter1'
    };
// var dbConfig = {
//     contactPoints : ['35.245.184.207'],
//     keyspace:'traffic_data',
//     localDataCenter: 'datacenter1'
// };
var connection = new cassandra.Client(dbConfig);

connection.connect(function(err,result){
    console.log('cassandra connected');
});

var rows=[];
var x=0;
app.get('/Crashes',function(req,res){
	var select = 'SELECT * from crashes;';
	connection.stream(select).on('readable',function(){
        while(row=this.read()){
            //console.log(row.longitude);
            rows[rows.length]=row;
            x++;
        }
    }).on('end', function () {
        // Stream ended, there aren't any more rows
        //console.log(x+"   "+ rows);
        res.send(rows);
      })
      .on('error', function (err) {
        // Something went wrong: err is a response error from Cassandra
      });
    });

//get unsolved crashes
// app.get('/Crashes',function(req,res){
// 	var select = 'SELECT * from crashes;';
// 	connection.execute(select,function(err, rows){
//         try{
//         if(rows.rows.length != 0){
//             res.send(rows.rows);
//             console.log(rows.rows[0].longitude+"   "+rows.rows.length);
// 		}else{
// 			res.json('no data found');
//         }
//         }
//         catch(err){console.log(err);}
// 	});
// });


app.get('/UserWeb',function(req,res){

    var select = "SELECT * from utilizatorWeb where userid='"+req.query.UserId+"' and userpass='"+req.query.pass+"';";
	connection.execute(select,function(err, rows){
        try{
        if(rows.rows.length== 0){
            res.json('no data found');

		}else{
            res.json('succes');
        }
        }
        catch(err){console.log(err);}
	});

})


app.get('/Solved',function(req,res){

    console.log(req.query.id);
    var select = "SELECT * from crashes where uuid='"+req.query.id+"';";
    connection.execute(select,function(err, rows){
        try{
        if(rows.rows.length != 0){
            var insert = 'INSERT INTO solvedCrashes(uuid, latitude, longitude, timedatec,timedates) VALUES (?,?,?,?,?);';
        try{
            var d = new Date();
            var n = d.toLocaleString();
            connection.execute(insert,[rows.rows[0].uuid,rows.rows[0].latitude,rows.rows[0].longitude,rows.rows[0].timedate,n], { prepare: true },function(err){
			console.log(err);
			if(!!err){
                console.log("error--- "+ err)
			}else{
                  console.log("Data succesfully added to solved crashes " );
                  var del="delete from crashes where uuid='"+req.query.id+"';";
                    try{
                    connection.execute(del,function(err){
			        if(!!err){
                     console.log("err  "+err)
			        }else{
                    io.sockets.emit('deleted',{ uuid: req.query.id});
                    console.log("Data succesfully deleted " + del);
                    }
                     });
                    }catch(err){
                    console.log(err);
                    }
			    }
            });
        }catch(err){
            console.log(err);
        }        
    }else{
       console.log("no data");
    }
    }
    catch(err){console.log(err);}
    });
    res.send({res:'Done'});
})


app.use(function (error, req, res, next) {
    if(error instanceof SyntaxError){ //Handle SyntaxError here.
      return res.status(500).send({data : "Invalid data"});
    } else {
      next();
    }
  });


app.post('/addCrash',function(req,res){
    
        console.log( req+' dataaas '+ req.body.uuid);
		var insert = 'INSERT INTO crashes(uuid, latitude, longitude, timedate) VALUES (?,?,?,?);';
		
        try{
        connection.execute(insert,[req.body.uuid,req.body.longitude,req.body.latitude,req.body.timeStamp], { prepare: true },function(err){
			console.log(err);
			if(!!err){
                console.log("error--- "+ err)
			}else{
                  io.sockets.emit('broadcast',{ latitude: req.body.latitude, longitude: req.body.longitude, uuid:req.body.uuid});
                  console.log("Data succesfully added " + req.body.latitude);
			}
        });
        }catch(err){
            console.log(err);
        }        
        res.send({'uuid':req.body.uuid,'latitude':req.body.latitude,'longitude':req.body.longitude,'timeStamp':req.body.timeStamp});

		
});
io.on('connection', function(socket) {
  
   socket.on('disconnect', function () {
      
   });
});

//android and server comunication
server.listen(3000, () => {
 console.log("Server running on port 3000");
});


app.get('/',function(req,res){
    res.sendfile('login.html');
	
});


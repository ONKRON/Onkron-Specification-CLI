const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.host,
  user: process.env.user,
  database: process.env.database,
  password: process.env.password,
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Успешное подключение к БД!');
    let sql = 'SELECT * FROM products_specifications';
    connection.query(sql, (err, results) => {
      if (err) throw err;
      results.forEach((row)=> {
        if (row.specifications_id == 60) {
          if(row.specification == 'Белый') {
            row.specification = 'White'
          } else if (row.specification == 'Черный') {
            row.specification = 'Black'
          } else if (row.specification == 'Серый' || row.specification == 'Серебристый') {
            row.specification = 'Silver'
          } else if (row.specification == 'Синий') {
            row.specification = 'Blue'
          } else if (row.specification == 'Красный') {
            row.specification = 'Red'
          } 
         
       let newSpecification = row.specification
          let productId = row.products_id;
          row.language_id = 2
          row.specification = newSpecification
          console.log(row.specification, row.products_id)

          // запрос на добавление должен выглядеть подобным образом: INSERT INTO products_specifications(products_id,language_id, specification, specifications_id) VALUES('52','2','232.98', '419')
         
          let updateSql = `INSERT INTO products_specifications(products_id,language_id, specification, specifications_id) VALUES('${productId}','${row.language_id}','${row.specification}','${row.specifications_id}')`;
          connection.query(updateSql, (err, updateResult) => {
            if (err) throw err;
            console.log('Обновлена таблица у продукта с ID:', productId);
            console.log(updateResult)
            console.log(newSpecification)
            console.log(updateSql)
          });
          
        }
      })
        

    });
  });
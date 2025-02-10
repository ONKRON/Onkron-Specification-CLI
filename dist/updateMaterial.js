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
    let sql = 'SELECT * FROM products_specifications WHERE language_id = 1 AND specifications_id = ';
    connection.query(sql, (err, results) => {
      if (err) throw err;
      results.forEach((row)=> {
        if (row.specifications_id == 61) {
          if (row.specification == 'Холоднокатаная сталь') {
            row.specification = 'SPCC cold rolled steel'
          } else if (row.specification == 'Нержавеющая сталь') {
            row.specification = 'Stainless steel'
          }
          else if (row.specification == 'Алюминий') {
            row.specification = 'Aluminum'
          }
          else if (row.specification == 'Пластик') {
            row.specification = 'Plastic'
          }
          else if (row.specification == 'Бук') {
            row.specification = 'Beech'
          }
          else if (row.specification == 'Резина') {
            row.specification = 'Rubber'
          }
          else if (row.specification == 'Стекло') {
            row.specification = 'Glass'
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
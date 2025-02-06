const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "shop.onkron.ru",
  user: "shop_o",
  database: "shop_onkron_ru",
  password: "8dYNH846SPvY",
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Успешное подключение к БД!');
    let sql = 'SELECT * FROM products_specifications';
    connection.query(sql, (err, results) => {
      if (err) throw err;
      results.forEach((row)=> {
        if (!row.specifications_id == 23) {
          console.log(row.products_id)
           //чтобы получить единицу в фунтах нужно:
             let newSpecification = (parseFloat(row.specification * 2.2).toFixed(2)).toString();
          newSpecification = Math.round(newSpecification * 100) / 100;
        if (newSpecification % 1 === 0) {
          newSpecification = Math.round(newSpecification);
        }
        
          let productId = row.products_id;
          row.language_id = 2
          row.specification = newSpecification
          console.log(row.specification, row.products_id)

          // запрос на добавление должен выглядеть подобным образом: INSERT INTO products_specifications(products_id,language_id, specification, specifications_id) VALUES('52','2','232.98', '419')
         
          //let updateSql = `INSERT INTO products_specifications(products_id,language_id, specification, specifications_id) VALUES('${productId}','${row.language_id}','${row.specification}','${row.specifications_id}')`;
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
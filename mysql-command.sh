# Install MySQL client
sudo yum install -y mariadb105
 
# Cek endpoint RDS (ambil dari Console RDS)
# Contoh endpoint: db-lomba.xxxxx.ap-southeast-1.rds.amazonaws.com
 
# Konek ke RDS
mysql -h db-lomba.c3y6msceserk.ap-southeast-1.rds.amazonaws.com -u admin_lomba -p
# Masukkan password: LombaBanten2026
 
# Setelah masuk MySQL, jalankan:
USE db_lomba;
 
CREATE TABLE peserta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    foto_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
SHOW TABLES;
 
INSERT INTO peserta (nama, email, foto_url) VALUES ('Test User', 'test@email.com', 'https://example.com/foto.jpg');
 
SELECT * FROM peserta;
 
EXIT;

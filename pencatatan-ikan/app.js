const express = require("express");
const mysql = require("mysql");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const app = express();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "sistem_informasi_ikan",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL");
});

// Konfigurasi session
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware untuk session
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isAuthenticated;
  res.locals.username = req.session.username;
  next();
});

// Middleware untuk mengecek status login pada halaman login dan register
function redirectIfAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    return res.redirect("/"); // Arahkan ke halaman index jika sudah login
  }
  next();
}
function isAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    return next(); // User is authenticated, proceed to the next middleware
  }
  res.redirect("/"); // User is not authenticated, redirect to the index page
}
// Halaman index
app.get("/", (req, res) => {
  res.render("index");
});

// Halaman register
app.get("/register", redirectIfAuthenticated, (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hashedPassword],
    (err) => {
      if (err) throw err;
      res.redirect("/login");
    }
  );
});

// Halaman login
app.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        const isMatch = await bcrypt.compare(password, results[0].password);
        if (isMatch) {
          req.session.isAuthenticated = true;
          req.session.username = results[0].username;
          return res.redirect("/");
        }
      }
      res.redirect("/login");
    }
  );
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Route untuk menampilkan daftar pengguna
app.get("/users", isAuthenticated, (req, res) => {
  db.query("SELECT * FROM users", (error, userResults) => {
    if (error) {
      console.error("Error fetching user data:", error);
      return res.status(500).send("Error fetching user data");
    }
    res.render("dataUsers", { users: userResults });
  });
});

// Route untuk menambahkan pengguna baru
app.post("/users/add", (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10); // Menggunakan bcrypt untuk hash password

  db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hashedPassword],
    (err) => {
      if (err) throw err;
      res.redirect("/users");
    }
  );
});

// Route untuk menampilkan form edit pengguna
app.get("/users/edit/:id", isAuthenticated, (req, res) => {
  const userId = req.params.id;

  db.query(
    "SELECT * FROM users WHERE id = ?",
    [userId],
    (error, userResults) => {
      if (error || userResults.length === 0) {
        return res.status(404).send("User not found");
      }

      const userItem = userResults[0];
      res.render("editUser", { user: userItem });
    }
  );
});

// Route untuk memperbarui pengguna
app.post("/users/update/:id", (req, res) => {
  const userId = req.params.id;
  const { username, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10); // Menggunakan bcrypt untuk hash password

  db.query(
    "UPDATE users SET username = ?, email = ?, password = ? WHERE id = ?",
    [username, email, hashedPassword, userId],
    (error) => {
      if (error) {
        return res.status(500).send(error);
      }
      res.redirect("/users");
    }
  );
});

// Route untuk menghapus pengguna
app.post("/users/delete/:id", (req, res) => {
  const userId = req.params.id;
  db.query("DELETE FROM users WHERE id = ?", [userId], (err) => {
    if (err) throw err;
    res.redirect("/users");
  });
});

// Route to display the list of fish and the add fish form
app.get("/ikan", isAuthenticated, (req, res) => {
  const ikanQuery =
    "SELECT ikan.*, spesies.nama_spesies, habitat.nama_habitat FROM ikan JOIN spesies ON ikan.spesies_id = spesies.id JOIN habitat ON ikan.habitat_id = habitat.id";

  // Fetch fish data
  db.query(ikanQuery, (error, ikanResults) => {
    if (error) {
      console.error("Error fetching data:", error);
      return res.status(500).send("Error fetching data");
    }

    // Fetch species and habitat data
    const spesiesQuery = "SELECT * FROM spesies";
    const habitatQuery = "SELECT * FROM habitat";

    db.query(spesiesQuery, (error, spesiesResults) => {
      if (error) {
        console.error("Error fetching species data:", error);
        return res.status(500).send("Error fetching species data");
      }

      db.query(habitatQuery, (error, habitatResults) => {
        if (error) {
          console.error("Error fetching habitat data:", error);
          return res.status(500).send("Error fetching habitat data");
        }

        // Render the view without edit mode
        res.render("dataIkan", {
          ikan: ikanResults || [],
          spesies: spesiesResults || [],
          habitat: habitatResults || [],
          editMode: false, // Set editMode to false
        });
      });
    });
  });
});

// Route to add a new fish
app.post("/ikan/add", (req, res) => {
  const { nama_ikan, spesies_id, habitat_id } = req.body;
  db.query(
    "INSERT INTO ikan (nama_ikan, spesies_id, habitat_id) VALUES (?, ?, ?)",
    [nama_ikan, spesies_id, habitat_id],
    (err, result) => {
      if (err) throw err;
      res.redirect("/ikan");
    }
  );
});

// Route to delete a fish
app.post("/ikan/delete/:id", (req, res) => {
  const ikanId = req.params.id;
  db.query("DELETE FROM ikan WHERE id = ?", [ikanId], (err, result) => {
    if (err) throw err;
    res.redirect("/ikan");
  });
});

// Route to display the edit form for a specific ikan
app.get("/ikan/edit/:id", isAuthenticated, (req, res) => {
  const ikanId = req.params.id;

  // Fetch the specific ikan data
  db.query(
    "SELECT * FROM ikan WHERE id = ?",
    [ikanId],
    (error, ikanResults) => {
      if (error || ikanResults.length === 0) {
        return res.status(404).send("Ikan not found");
      }

      const ikanItem = ikanResults[0]; // This will be an object

      // Fetch all spesies data
      db.query("SELECT * FROM spesies", (err, spesiesResults) => {
        if (err) {
          return res.status(500).send(err);
        }

        // Fetch all habitat data
        db.query("SELECT * FROM habitat", (habitatErr, habitatResults) => {
          if (habitatErr) {
            return res.status(500).send(habitatErr);
          }

          // Pass ikan, spesies, and habitat data to the edit view
          res.render("editIkan", {
            ikan: ikanItem,
            spesies: spesiesResults,
            habitat: habitatResults,
          });
        });
      });
    }
  );
});

// Route to handle the form submission for updating ikan
app.post("/ikan/update/:id", (req, res) => {
  const ikanId = req.params.id;
  const { nama_ikan, spesies_id, habitat_id } = req.body;

  // Update the ikan record in the database
  db.query(
    "UPDATE ikan SET nama_ikan = ?, spesies_id = ?, habitat_id = ? WHERE id = ?",
    [nama_ikan, spesies_id, habitat_id, ikanId],
    (error, results) => {
      if (error) {
        return res.status(500).send(error);
      }

      // Redirect to the ikan list or detail page
      res.redirect("/ikan"); // Change this path as needed
    }
  );
});

// Route untuk menampilkan daftar spesies
app.get("/spesies", isAuthenticated, (req, res) => {
  db.query("SELECT * FROM spesies", (error, spesiesResults) => {
    if (error) {
      console.error("Error fetching species data:", error);
      return res.status(500).send("Error fetching species data");
    }
    res.render("dataSpesies", { spesies: spesiesResults });
  });
});

// Route untuk menambahkan spesies
app.post("/spesies/add", (req, res) => {
  const { nama_spesies } = req.body;
  db.query(
    "INSERT INTO spesies (nama_spesies) VALUES (?)",
    [nama_spesies],
    (err) => {
      if (err) throw err;
      res.redirect("/spesies");
    }
  );
});

// Route untuk menghapus spesies
app.post("/spesies/delete/:id", (req, res) => {
  const spesiesId = req.params.id;
  db.query("DELETE FROM spesies WHERE id = ?", [spesiesId], (err) => {
    if (err) throw err;
    res.redirect("/spesies");
  });
});

// Route untuk menampilkan form edit spesies
app.get("/spesies/edit/:id", isAuthenticated, (req, res) => {
  const spesiesId = req.params.id;

  db.query(
    "SELECT * FROM spesies WHERE id = ?",
    [spesiesId],
    (error, spesiesResults) => {
      if (error || spesiesResults.length === 0) {
        return res.status(404).send("Spesies not found");
      }

      const spesiesItem = spesiesResults[0];
      res.render("editSpesies", { spesies: spesiesItem });
    }
  );
});

// Route untuk memperbarui spesies
app.post("/spesies/update/:id", (req, res) => {
  const spesiesId = req.params.id;
  const { nama_spesies } = req.body;

  db.query(
    "UPDATE spesies SET nama_spesies = ? WHERE id = ?",
    [nama_spesies, spesiesId],
    (error) => {
      if (error) {
        return res.status(500).send(error);
      }
      res.redirect("/spesies");
    }
  );
});

// Route untuk menampilkan daftar habitat
app.get("/habitat", isAuthenticated, (req, res) => {
  db.query("SELECT * FROM habitat", (error, habitatResults) => {
    if (error) {
      console.error("Error fetching habitat data:", error);
      return res.status(500).send("Error fetching habitat data");
    }
    res.render("dataHabitat", { habitat: habitatResults });
  });
});

// Route untuk menambahkan habitat
app.post("/habitat/add", (req, res) => {
  const { nama_habitat } = req.body;
  db.query(
    "INSERT INTO habitat (nama_habitat) VALUES (?)",
    [nama_habitat],
    (err) => {
      if (err) throw err;
      res.redirect("/habitat");
    }
  );
});

// Route untuk menghapus habitat
app.post("/habitat/delete/:id", (req, res) => {
  const habitatId = req.params.id;
  db.query("DELETE FROM habitat WHERE id = ?", [habitatId], (err) => {
    if (err) throw err;
    res.redirect("/habitat");
  });
});

// Route untuk menampilkan form edit habitat
app.get("/habitat/edit/:id", isAuthenticated, (req, res) => {
  const habitatId = req.params.id;

  db.query(
    "SELECT * FROM habitat WHERE id = ?",
    [habitatId],
    (error, habitatResults) => {
      if (error || habitatResults.length === 0) {
        return res.status(404).send("Habitat not found");
      }

      const habitatItem = habitatResults[0];
      res.render("editHabitat", { habitat: habitatItem });
    }
  );
});

// Route untuk memperbarui habitat
app.post("/habitat/update/:id", (req, res) => {
  const habitatId = req.params.id;
  const { nama_habitat } = req.body;

  db.query(
    "UPDATE habitat SET nama_habitat = ? WHERE id = ?",
    [nama_habitat, habitatId],
    (error) => {
      if (error) {
        return res.status(500).send(error);
      }
      res.redirect("/habitat");
    }
  );
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

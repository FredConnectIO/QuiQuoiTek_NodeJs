const express = require("express");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));


// ENREGISTRER text.txt

app.post("/enregistrer", (req, res) => {

    const texte = req.body.texte;

    fs.writeFile("text.txt", texte, "utf8", (err) => {

        if (err) {
            console.error(err);
            return res.status(500).send("Erreur écriture");
        }

        res.send("OK");
    });

});


// LIRE text.txt

app.get("/lire", (req, res) => {

    fs.readFile("text.txt", "utf8", (err, data) => {

        if (err) {

            // Si le fichier n'existe pas encore
            if (err.code === "ENOENT") {
                return res.send("");
            }

            console.error(err);
            return res.status(500).send("Erreur lecture");
        }

        res.send(data);
    });

});


app.listen(3000, () => {
    console.log("Serveur démarré : http://localhost:3000");
});

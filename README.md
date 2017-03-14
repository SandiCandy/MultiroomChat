# Start #

Voraussetzung: Node.js + NPM installiert (Version prüfen über node -v bzw. npm -v)

1. Abhängigkeiten updaten: "npm install"
2. Server starten: "node app.js"
3. Aufruf im Browser: "localhost:3000"        (Standard)
                bzw.: "localhost:3000/login"  (Adminlogin)

# Features #

* mehrere Räume
* wechseln zwischen Räumen
* private und öffentliche Räume
* Bilder und Nachrichten versenden
* leere Räume löschen
* User schließt Fenster: User wird gelöscht
* Unterschiedliche Rollen: Administrator, Raumbesitzer, normaler Nutzer
* Defaulträume - existieren immer, auch wenn diese leer sind (siehe config.json)


# Sonderbefehle #
* "/help" (Liste von Sonderbefehlen)
* "/lock" (Raum als privat setzen)
* "/unlock" (Raum als öffentlich setzen)
* "/remove <username>" (User aus einem Raum entfernen)
* "/all <nachricht>" (Admindurchsage an alle User in allen Räumen)
* "/owns <username>" (User zum Raumbesitzer ernennen)
* "/ownsNot <username>" (User die Raumbesitzer-Rechte entziehen)

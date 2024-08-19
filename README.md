# tahvel-userscripts

## Kuidas installeerida õpetajatele mõeldud skripti

Alustuseks on vaja veebilehitsejale installeerida Tampermonkey laiendus.
Vali [Tampermonkey koduelehelt](https://www.tampermonkey.net/index.php?locale=en) enda veebilehitseja ja seejärel vajuta alt `Get from Store`

Pärast laienduse paigaldamist tuleb lisada Tahvli jaoks skript. Alustuseks otsi üles tööriistariba pealt Tampermonkey logo (see võib olla peidus ka kolme punkti/kriipsu või pusletüki taga menüüs).  
Seejärel saad valida `Create a new script...`  
![create-script](https://github.com/user-attachments/assets/23a32bc9-87cb-446a-ad4f-5e23d9d9c876)  
Avanevasse aknasse tuleks kleepida [teachers.js](https://raw.githubusercontent.com/Tallinna-Polutehnikum/tahvel-userscripts/main/teachers.js) faili seest kogu kood, seejärel salvestada (Ctrl+S)

Kui kõik õigesti läks siis Tahvlisse minnes Tampermonkey näitab seda skripti nime ja rohelist nuppu - kõik toimib.
![install-success](https://github.com/user-attachments/assets/031166d6-4f85-4768-98d4-fa98bc4a4eaa)

Edaspidi uuendab see end selles konkreetses arvutis ise. Igasse arvutisse tuleb see eraldi paigaldada.

## Funktsioonid
### Keskmised hinded
Selleks, et keskmist hinnet arvutaks on vaja lisada päevikusse Perioodi hinde sissekanne (kasvõi ilma kuupäevata).
![keskmine-hinne](https://github.com/user-attachments/assets/1ecf9641-6cd4-4699-95a1-7b891ee91e66)  
*\*A ehk arvestatud ei arvutata keskmise hindena. MA ja X arvestatakse hindena 0*
### Tunni kirjeldus
![tunni-kirjeldus](https://github.com/user-attachments/assets/4657dd65-addd-4279-b7ba-20a5bf3ba6bc)
### Määra kõik korraga puudujateks
![koik-puudujaks](https://github.com/user-attachments/assets/e120546b-27e3-4d1f-96b5-55e544ecd1c0)
### Ja mõned muud pisemad asjad
- Õpilasele teavituse linnuke automaatselt kui valid liigiks Hindamine või kirjutad kodutöö kirjelduse.
![kodutoo](https://github.com/user-attachments/assets/7221155a-9d4d-484c-8f64-f4339655eca8)
- Õpilaste nimekirjas näitab õpilase vanust isikukoodi kõrval
- Rühmajuhendaja aruandes täidab õppeaasta ja kuupäeva vastvalt rühma koodile automaatselt

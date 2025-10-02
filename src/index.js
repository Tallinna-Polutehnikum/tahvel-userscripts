import './features/randomRequest.js'
import './features/usageLogger.js'
import './features/teachers.js'
import './features/gradeHistory.js'

// Teachers.js
/**
 * Kuidas seda skripti lugeda/täiendada:
 *  - Voldi IDE-s kõik kommentaari regioonid kokku, et näha ainult pealkirju.  VSC: Ctrl+Shift+P -> Fold All Regions
 *  - Kood algab mutation observeriga, iga kord kui leht muutub käivitatakse skript uuesti vastavalt aadressile ja sisule.
 *    See osa asub `#region Entry point to scripts and MutationObserver config` -> fn `observeTargetChange`
 *    Olen pannud igale feature'le HTML atribuutidena markeri, et kood on juba käivitatud vältimaks mitmekordset rakendamist.
 *  - Sealt edasi saad `Go to Definition` (Ctrl+Mouse Left Button) abil funktsiooni nimede peal. Allpool entry regionit olen pannud kõik funktsioonaalsuse ja nende kirjeldused
 *    uuesti regionite sisse - lihtsalt selleks, et kinni-lahti voltimine oleks kergem. Ma tundsin, et on parem kui need pole kõik mutatsiooni observeri sees.
 *  - Kõige põhjas (faili lõpus) on re-usable asjad
 */


// Features:
// - Päevikus näeb õpilase keskmist hinnet (nüüd ka ilma perioodihindeta)
// - Päevikus saab kõik õpilased korraga puudujaks märkida
// - Päevikus näitab aktiivset rida paksema piirjoonega
// - Päevikus kande taustavärv rakendub tervele veerule
// - Õpilaste nimekirjas näitab õpilase vanust isikukoodi kõrval
// - Rühmajuhataja aruandes täidab õppeaasta ja kuupäeva vastvalt rühma koodile automaatselt
// - Rühmajuhataja aruandes saab JSON formaadis alla laadida, et pingeread koostada (töös, vajab täiendamist)
// - Rühmajuhataja aruandes toob koondandmed tabeli ette, lisab negatiivsed hinded
// - Admin/tugitöötaja saab õpilase profiilis näha negatiivsete hinnete kokkuvõtet vahekaardil "Sooritamise järjekorras"
// - Admin/tugitöötaja saab õpilase profiilis "Õppekava täitmine" vahekaardil avada päeviku, mooduli protokolli ja lisada uue protokolli
// - Päevikute nimekirjas on tänased päevikud kõige ees
// - TODO Rühmajuhataja aruandes saaks printida PDFi ainult võlgenvustest millel pole päevikus positiivset lõpphinnet
// - TODO Päevikus tundi sisestades täidetakse ära tunni algus ja pikkus vastavalt tunniplaanile
// - TODO Päevik näitab varasema tunniplaani põhjal kas mõni tund on sisestamata jäänud
// - TODO Päevikus saab hinde peale klikkides ühe hinde ära muuta
// - TODO Päevikus saab peita õpilaste hinnete ajaloo
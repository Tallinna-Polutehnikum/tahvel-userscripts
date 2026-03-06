import './modules/sessionKeepAlive.js';
import './modules/usageLogger.js';
import './modules/teachers.js';
import './modules/reports/stipend-eligibility/windowApi.js';

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

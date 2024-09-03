/**
 * Marathon Map
 * Despliega un mapa de la maratón de Medellín calculando la hora en la cual el aleta
 * pasará por los checkpoints definidos y mostrando la información al hacer clic sobre
 * cada checkpoint
 * 
 * Librería moment ID: 15hgNOjKHUG4UtyZl9clqBbl23sDvWMS8pfDJOyIapZk5RBqwL3i-rlCo
 */

// Hora de inicio
const STARTTIME = '5:30:00';
const SS_INFO = '<ID_HOJA_DE_CALCULO_CHECKPOINTS>';
const SS_CHKP = 'Checkpoints';  // Nombre de la hoja donde residen los datos de los checkpoints

/**
 * doGet 
 * Despliega la forma de registro de datos / Mapa generado 
 * 
 * @param {object} e - Objeto con los datos desde la url
 * @retun {string} output - salida html
 */ 
function doGet( e ) {
  let output = '';
  // Despliega la forma de captura de datos
  if ( e.parameter.o != 'm' ) {
    output = getForm();
  } else {
    // Despliega el Mapa generado 
    output = getMap( e.parameter.n, e.parameter.p );
  };
  // Despliegue del resultado
  return HtmlService.createHtmlOutput( output )
                    .setSandboxMode( HtmlService.SandboxMode.IFRAME )
                    .setXFrameOptionsMode( HtmlService.XFrameOptionsMode.ALLOWALL )
                    .addMetaTag( 'viewport', 'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, shrink-to-fit=no' )
                    .setFaviconUrl( '<**URL**>/favicon.png' )
                    .setTitle( 'MarathonMap' );
};

/**
* getForm
* Despliega la forma para el registro de los datos del atleta
*
* @param {void} - void
* @return {string} - Cadena HTML de la forma 
**/
function getForm() {
  // Template de la forma de captura de datos del atleta
  var tpl_formupload = HtmlService.createHtmlOutputFromFile( 'form.html' ).getContent();
  return tpl_formupload;
};

/**
 * getUrlMap
 * genera la url de la app con los parametros recibidos de la forma y que permite desplegar el mapa
 * 
 * @param {object} Parameters - Objeto con los datos del atleta capturados en la forma ( name y pace )
 * @return {string} html - cadena html con la url de la webapp y los parametrós del caso
 */
function getUrlMap( Parameters ) {
  // Url de la webapp (actual) que permite el despliegue del mapa
  let urlApp = 'https://script.google.com/a/macros/<**DOMINIO**>/s/<**IDWEBAPP**>/exec?o=m';
  urlApp = `${urlApp}&n=${Parameters.name}&p=${Parameters.pace}`;
  // Enlace
  let html = `<a href="${urlApp}" target="_blank">Ver el Mapa generado</a>`;
  return html;
};

/**
 * getMap
 * Carga los templates del mapa, css y las coordenadas del recorrido de la maratón. Calcula los tiempos
 * de acuerdo de cada checkpoint ( registrados en hoja de cálculo ) y reemplaza todos los valores de acuerdo
 * al template del mapa
 * 
 * @param {string} Name - Nombre del atleta
 * @param {string} Pace - Ritmo en el que se estima va a correr. Formato '00:00:00' 
 * @return {string} - Cadena HTML del mapa
 */
function getMap( Name, Pace ) {
  // carga los templates para despliegue
  let mapHtml = HtmlService.createHtmlOutputFromFile( 'map.html' ).getContent();
  let tpl_css = HtmlService.createHtmlOutputFromFile( 'css.html' ).getContent();
  let tpl_coordinates = HtmlService.createHtmlOutputFromFile( 'coordinates.html' ).getContent();
  let checkpoints = calculateData( Pace );
  // Arma la plantilla final
  mapHtml = mapHtml.replace( '##CSS##', tpl_css );
  mapHtml = mapHtml.replace( '##CHECKPOINTS##', checkpoints.tpl );
  mapHtml = mapHtml.replace( '##COORDINATES##', tpl_coordinates );
  mapHtml = mapHtml.replace( '##NAME##', Name );
  mapHtml = mapHtml.replace( '##PACE##', Pace );
  mapHtml = mapHtml.replace( '##STARTTIME##', STARTTIME );
  mapHtml = mapHtml.replace( '##ENDTIME##', checkpoints.finaltime );
  mapHtml = mapHtml.replace( '##TIME##', checkpoints.finalacum );
  return mapHtml;
};

/**
 * getCheckpoints
 * A partir de los datos de los checkpoints que se encuentran almacenado en la hoja de cálculo, genera
 * un arreglo de objetos donde se guardan los datos de cada checkpoint
 * 
 * @param {void} - void
 * @return {array} - Arreglo de objetos que contienen los datos de cada checkpoint 
 */
function getCheckpoints() {
  // Acceso a la hoja donde están definidos los checkpoints
  let sheet = SpreadsheetApp.openById( SS_INFO ).getSheetByName( SS_CHKP );
  let table = sheet.getDataRange().getValues();
  // Arreglo para almacenar los checkpoints como objetos para manupular los valores
  let checkpoints = [];
  // header - nombres de las llaves del objeto
  let header = table.shift();
  for ( let indx=0; indx< table.length; indx++ ) {
    let row = table[ indx ];
    let point = {};
    let position = {};
    for ( let jndx=0; jndx<row.length; jndx++ ) {
      let pass = false;
      if ( header[ jndx ].charAt( 0 ) == '_' ) {
        position[ header[ jndx ].slice(1) ] = JSON.parse( row[ jndx ] );
        subobj = position;
        pass = true;
      } else {
        subobj = row[ jndx ];
      };
      // Tiene en cuenta el subojeto position que contiene lat y long
      if ( pass ) {
        point[ 'position' ] = subobj;
      } else {
        point[ header[ jndx ] ] = subobj;
      };
    };
    checkpoints.push( point );
  };
  // Arreglo que contiene objetos con la informacion de los checkpoints
  return checkpoints;
};

/**
 * calculateData
 * Dado el pace del atleta, obtiene los checkpoints definidos y calcula para cada uno de ellos, la hora estimada
 * en la que pasará el atleta y el tiempo acumulado. esta información es guardado en una cadena que sirve para definir
 * la variable checkpoints que es reemplazada en el template del mapa para que el js pueda generar los checkpoints sobre 
 * el mapa
 * 
 * @param {string} Pace - Paso estimado del atleta. Formato '00:05:50'
 * @retunr {object} checkPointsObj - Objeto con los datos generados
 *  tpl - cadena con la definición de la constante checkpoints para ser reemplazada en el template del mapa
 *  finaltime - tiempo final calculado
 *  finalcum - tiempo acumulado calculado
 */
function calculateData( Pace ) {
    // Hora de inicio / pace y tiempo acumulado
    const start = Moment.moment( STARTTIME, 'HH:mm:ss' )
    const pace = Moment.moment.duration( Pace ).asSeconds();
    const acum = Moment.moment( '00:00:00', 'HH:mm:ss' );
    // Calcula el paso por kilómetro
    const averagePace = 1000/pace;
    // Obtiene los checkpoints desde la hoja
    let checkpointsArr = getCheckpoints();
    // Actualiza cada chckpoint ( time ) con el tiempo calculado a partir del Pace y STARTTIME
    for ( var indx=0; indx<checkpointsArr.length; indx++ ) {
      let stimatedTime = ( checkpointsArr[ indx ].dist * 1000 ) / averagePace;
      checkpointsArr[ indx ].time = start.clone().add( stimatedTime, 'seconds' ).format( 'HH:mm:ss' );
      checkpointsArr[ indx ].acum = acum.clone().add( stimatedTime, 'seconds' ).format( 'HH:mm:ss' );
    };
    // Arma cadena con el objeto actualizado para ser reemplazado en la hoja del mapa
    let checkPointsObj = { tpl: `const checkpoints = ${JSON.stringify( checkpointsArr, 2, null )};`,
                           finaltime: checkpointsArr[ indx-1 ].time,
                           finalacum: checkpointsArr[ indx-1 ].acum };
    return checkPointsObj;
};

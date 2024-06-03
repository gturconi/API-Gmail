------------CONFIGURAR API DE GMAIL------------------

1. Crear un nuevo proyecto en Google Cloud Platform

https://console.cloud.google.com/

Clic en Create Project.
En la ventana nuevo proyecto que aparece, ingrese un nombre de proyecto.
Ingresar la organización.

2. Habilitar la API de Gmail

Para ello dirigirse a la pestaña Biblioteca y buscar " API de Gmail " 


---------------CONFIGURAR CONSENTIMIENTO-----------------
Ir a la sección "Pantalla de consentimiento" y aceptar los permisos.
En User type elegir: External
Test Users(opcional): Agregar la dirección de correo que se está configurando en este momento. 

---------------HABILITAR CREDENCIALES-------------------
Hacer click en Credenciales -> "Crear credenciales" ->  ID de cliente OAuth

Ingresar nombre de la Aplicacion, dominios autorizados y URl de redireccionaminamiento.
El nombre de la Aplicacion puede ser cualquiera, el dominio autorizado tiene que ser la 
dirección del web service al que deseamos apuntar.
La dirección de redireccionamiento es la misma que la anterior pero se le añade: /oauth2callback.

Si nos pide asignar roles lo dejamos vacío.
Cuando nos pide configurar los permisos, seleccionamos todos los permisos correspondientes a 
API Gmail, excepto el de meta. 

Descargar el json y renombrarlo a: credentials.json y colocarle en la raiz del proyecto. 
Alternativamente se puede prescindir del .json mediante la creación de variables de entorno 
o almacenando y recuperando las credenciales en una base de datos. 

------------CONFIGURAR API DE PUB/SUB------------------
1. Crear tópico 

Ingresar a la web:

https://cloud.google.com/pubsub

Seleccionar Probar Pub/Sub Gratis y seleccionamos el proyecto que se creó anteriormente.
Por último, si todo salió bien, debe mostrar un pop-up con un ID.

Ahora nos dirigmos a la página: 
https://cloud.google.com/pubsub/docs/quickstart-console#create_a_topic

Seleccionar crear tema, ingresar el nombre del tópico y presionar el botón "Crear".

2. Agregar permisos

En la ventana derecha seleccionar la sección "Permisos" y presionar el botón "Agregar Principal".
En el input "Principales nuevas" colocar: gmail-api-push@system.gserviceaccount.com
En el combo asignar roles elegir: Publicador Pub/Sub 
Presionar Guardar.

3. Crear una subscripción:

En el topic creado damos clic en los tres puntos finales y luego en "Crear subscripción".
Ingresamos un ID para la subscription y en Delivery type seleccionamos de tipo "Enviar" e ingresamos la URL del endpoint al cual queremos que lleguen las notificaciones de nuevos cambios en el inbox, el web service debe contar con un POST endpoint (ejemplo:
https://www.domain.com/api/notifications) para recibir las notificaciones.

En "Período de vencimiento" colocamos "Nunca vence"

En "Plazo de confirmación" colocamos 60 segundos.
Estos 60 segundos indica cuánto tiempo espera el Pub/Sub a que el suscriptor confirme que recibió la notificación antes de reenviar.

Presionamos "Crear".




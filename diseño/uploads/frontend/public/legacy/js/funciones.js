/*===========================================================================================================================
=                                                    funciones generales                                                    =
===========================================================================================================================*/
function mostrarModal(url,div,title) 
{	
	$("#modalTitle").html(title);
	$('#busdatos').modal('show');
	$.post(url,function(resp){
		$("#"+div+"").html(resp);
	});
}

function consultar(url,id,div)
{
	$.post(url,{id},function(resp){
		$("#"+div+"").html(resp);
	});
}

function kardexActualizar(url,nro,div)
{
	var saldof=$("#saldof"+nro+"").val();
	var costo=$("#costo"+nro+"").val();
	var saldov=$("#saldov"+nro+"").val();
	$('#busdatos').modal('show');
	$.post(url,{saldof,costo,saldov},function(resp){
		$("#"+div+"").html(resp);
	});
}

function enviodatos(url)
{
	event.preventDefault();
	var datos= new FormData($('#formdatos')[0]);
	$.ajax({
		url: url,
		type: 'POST',
		data: datos,
		contentType: false,
		processData: false,
		success: function(responder) {
			window.location.href=responder;
		},
		error: function(error) {
			console.log(error);
		}
	});
	$('#busdatos').modal('hide');
}

function dcliente(url)
{
	var tipo= $("#tipo").val();
	var numero= $("#documento").val();
	$.post(url,{tipo,numero},function(resp){
		if (resp=='') {
			toastr.error('No se pudo conectar con la pagina de consulta');
		} else {
			var c = JSON.parse(resp);
			//console.log(c);
			if (c.error) {
				toastr.error(c.error);
			} else {
				if (tipo==1) {
					document.getElementById('nombres').value = c.nombre;
				} else {
					let purl=url.replace('cliente/busDatos','establecimiento/busProvincia');
					let durl=url.replace('cliente/busDatos','establecimiento/busDistrito');
					document.getElementById('nombres').value = c.nombre;
					document.getElementById('direccion').value = c.direccion;

					if (c.ubigeo != '-') {
						let distrito=c.ubigeo;
						let departamento=distrito.substr(0,2);
						let provincia=distrito.substr(0,4);
						document.getElementById('departamento').value = departamento;
						bubicaciones(purl,departamento,'provincia',provincia);
						bubicaciones(durl,provincia,'distrito',distrito);
					}
				}
			}
		}
	});
}

function bubicacion(url,id,mos)
{
	$('#'+mos+'').html('');
	$.post(url,{id},function(data){
		var c = JSON.parse(data);
		$('#'+mos+'').append('<option value="">::Seleccione</option>');
		$.each(c, function(i,item){
			$('#'+mos+'').append('<option value="'+item.id+'">'+item.descripcion+'</option>');
		});
	});
}

function bubicaciones(url,id,mos,dato)
{
	$('#'+mos+'').html('');
	$.post(url,{id},function(data){
		var c = JSON.parse(data);
		$('#'+mos+'').append('<option value="">::Seleccione</option>');
		$.each(c, function(i,item){
			if (item.id==dato) {
				$('#'+mos+'').append('<option value="'+item.id+'" selected="true">'+item.descripcion+'</option>');
			} else {
				$('#'+mos+'').append('<option value="'+item.id+'">'+item.descripcion+'</option>');
			}
		});
	});
}

function borrar(url,nombre,cargar)
{
	Swal.fire({
		title: "Desea eliminar "+nombre+"?",
		text: "No podras revertir esto!",
		icon: 'warning',
		showCancelButton: true,
		confirmButtonText: "Si, borralo",
	  	cancelButtonText: "Cancelar",
		confirmButtonColor: '#3085d6',
		cancelButtonColor: '#d33',
	}).then((result) => {
		if (result.value) {
			$.post(url,function(response){
				if (response=='borrado') {
					Swal.fire("Borrado!", "El registro : "+nombre+" fue borrado", "success");
				    window.location=cargar; // direccionar a una pagina especifica
				}
				else {
					Swal.fire("No se puede borrar!", "El registro : "+nombre+" no fue borrado por que esta siendo usado en otro registro", "error");
				}
			});
		}
	})
}

function anular(url,nombre,cargar)
{
	Swal.fire({
		title: "Desea anular "+nombre+"?",
		text: "No podras revertir esto!",
		type: "warning",
		showCancelButton: true,
		confirmButtonText: "Si, anular esto!",
		cancelButtonText: "No, cancelar!",
		confirmButtonColor: '#3085d6',
		cancelButtonColor: '#d33',
	}).then((result) => {
		if (result.value) {
			$.post(url,function(response){
				if (response=='borrado') {
					Swal.fire("Anulado!", "El registro : "+nombre+" fue anulado", "success");
				    window.location=cargar; // direccionar a una pagina especifica
				}
				else {
					Swal.fire("No se puede anular!", "El registro : "+nombre+" no fue anulado por que esta siendo usado en otro registro", "error");
				}
			});
		}
	})
}

function saltar(e,ant,pos)
{
  // Obtenemos la tecla pulsada
  (e.keyCode)?k=e.keyCode:k=e.which;

  // Si la tecla pulsada es enter (codigo ascii 38 up y 40 down)
  if(k==38)
  {
    if (ant=='input-1') {
  		document.getElementById('bproducto').focus();
  	} else {
  		document.getElementById(ant).focus();
  	}
  }

  if(k==40)
  {
    document.getElementById(pos).focus();
  }
}

function establecimiento(valor,url)
{
	$.post(url,{valor},function(resp){
		if (resp==1) {
			toastr.success('Se actualizo el establecimiento');
		} else {
			toastr.error('No se pudo actualizar');
		}
	});
	location.reload();
}

function mostrarLotes(valor,div,vinput)
{
  if (valor.checked) {
      document.getElementById(div).style.display='block';
      $("#"+vinput+"").prop('required',true);
  }
  else {
      document.getElementById(div).style.display='none';
      $("#"+vinput+"").val('');
      $("#"+vinput+"").removeAttr("required");
  }
}

function accesocheck(valor,clase)
{
	if (valor.checked) {
        $('.'+clase+'').attr("checked",true);
    }
    else {
        $('.'+clase+'').attr("checked",false);
    }
}

function conversion(valor)
{
	var medida=valor.split('|'); //BX|100|50.00
	document.getElementById('mfactor').value= medida[1];
	document.getElementById('munidades').value= 1;
	document.getElementById('mcosto').value=medida[2];
	document.getElementById('mtotal').value=medida[2];

	document.getElementById('mcantidad').value= 1*medida[1];
	document.getElementById('mmonto').value=decimales(medida[2]/medida[1]);
	document.getElementById('munidades').select();
}

$(document).ready(function() {
	fceliminar();
	fveliminar();
	calcularc();
	calcularv();
});

function tieneNumeroEnURL(url)
{
  // Expresión regular para verificar si hay un número en la URL
  var regex = /\d/;

  // Aplicar la expresión regular a la URL
  return regex.test(url);
}

/*===========================================================================================================================
=                                                     operaciones basicas                                                   =
===========================================================================================================================*/
function redondear(value, decimals)
{
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function decimales(num)
{
	return parseFloat(num).toFixed(2);
}

function suma(total,sumando,resultado)
{
	var unidad=parseFloat($('#'+total+'').val());
	var unidac=parseFloat($('#'+sumando+'').val());
	var monto=unidad+unidac;
	if (!isNaN(monto)) {
		document.getElementById(resultado).value=decimales(monto);
	}else{
		document.getElementById(resultado).value='';
	}
}

function diferencia(total,minuendo,resultado)
{
	var unidad=parseFloat($('#'+total+'').val());
	var unidac=parseFloat($('#'+minuendo+'').val());
	var monto=unidad-unidac;
	if (!isNaN(monto)) {
		document.getElementById(resultado).value=decimales(monto);
	}else{
		document.getElementById(resultado).value=decimales(unidad);
	}
}

function factores(cantidad,factor,resultado)
{
	var unidad=parseFloat($('#'+cantidad+'').val());
	var unidac=parseFloat($('#'+factor+'').val());
	var monto=unidad*unidac;
	if (!isNaN(monto)) {
		document.getElementById(resultado).value=decimales(monto);
	}else{
		document.getElementById(resultado).value='';
	}
}

function divisores(costo,factor,resultado)
{
	var unidad=parseFloat($('#'+costo+'').val());
	var unidac=parseFloat($('#'+factor+'').val());
	var monto=unidad/unidac;
	if (!isNaN(monto)) {
		document.getElementById(resultado).value=decimales(monto);
	}else{
		document.getElementById(resultado).value='';
	}
}

function porcentajes(cantidad,factor,resultado)
{
	var unidad=parseFloat($('#'+cantidad+'').val());
	var unidac=parseFloat($('#'+factor+'').val()/100);
	var monto=unidad*unidac;
	if (!isNaN(monto)) {
		document.getElementById(resultado).value=decimales(monto);
	}else{
		document.getElementById(resultado).value='';
	}
}

function margen(costo,precio,factor,gananacia)
{
	var costo=parseFloat($('#'+costo+'').val());
	var venta=parseFloat($('#'+precio+'').val()/$('#'+factor+'').val());
	var resultado=redondear(((venta-costo)*100)/costo,2);

	if (!isNaN(resultado)) {
		document.getElementById(gananacia).value=resultado;
	}else{
		document.getElementById(gananacia).value='';
	}
}

function precios(costo,gananacia,precio,factor)
{
	var costo=parseFloat($('#'+costo+'').val());
	var porcentaje=$('#'+gananacia+'').val()/100;
	var resultado=redondear((costo+(costo*porcentaje))*$('#'+factor+'').val(),2);

	if (!isNaN(resultado)) {
		document.getElementById(precio).value=resultado;
	}else{
		document.getElementById(precio).value='';
	}
}

function unidades(factor)
{
	if (factor>1) {
		document.getElementById('precios').style.display = 'block';
		document.getElementById('factorc').value=factor;

		$('#venta').val('');
		$('#utilidadc').val('');

		$('#pblister').val('');
		$('#factorb').val('');
		$('#utilidadb').val('');
	} else {
		document.getElementById('precios').style.display = 'none';
	}
}

function calcularCompra()
{
	var incluye=$('#incluye').prop("checked");
	var porcentaje=parseFloat($('#porcentaje').val());
	var total=0;
	var contador = document.getElementsByName("importe[]").length;
  for(i=0;i<contador;i++){
      total += parseFloat(document.getElementsByName('importe[]')[i].value);
  }

    if (porcentaje>0) {
	    if (incluye) {
			var subtotal=total/(porcentaje+1);
			document.getElementById('subtotal').value=decimales(subtotal);
			var igv=subtotal*porcentaje;
			document.getElementById('igv').value=decimales(igv);
			document.getElementById('total').value=decimales(total);
	    } else {
			document.getElementById('subtotal').value=decimales(total);
			var igv=total*porcentaje;
			document.getElementById('igv').value=decimales(igv);
			var totales=total+igv;
			document.getElementById('total').value=decimales(totales);
	    }
    } else {
		document.getElementById('subtotal').value=decimales(total);
		var igv=total*porcentaje;
		document.getElementById('igv').value=decimales(igv);
		var totales=total+igv;
		document.getElementById('total').value=decimales(totales);
    }
}

function calcularCotizacion()
{
	var totales=0;
	var contador = document.getElementsByName("importe[]").length;
	for(i=0;i<contador;i++){
		totales += parseFloat(document.getElementsByName('importe[]')[i].value);
	}

	document.getElementById('totalg').value=decimales(totales);
}

function calcularVenta()
{
	var igravada=0;
	var exonerada=0;
	var inafecta=0;
	var contador = document.getElementsByName("importe[]").length;
	for(i=0;i<contador;i++){
		let afectacion=document.getElementsByName('tafectacion[]')[i].value;
		if (afectacion==30) {
			inafecta += parseFloat(document.getElementsByName('importe[]')[i].value);
		} else if(afectacion==20) {
			exonerada += parseFloat(document.getElementsByName('importe[]')[i].value);
		}  else {
			igravada += parseFloat(document.getElementsByName('importe[]')[i].value);
		}
	}

	var gravada=igravada/1.18;
	document.getElementById('bimponible').value=decimales(gravada);
	document.getElementById('gravado').value=decimales(gravada);
	document.getElementById('exonerado').value=decimales(exonerada);
	document.getElementById('inafecto').value=decimales(inafecta);
	var igv=gravada*0.18;
	document.getElementById('igv').value=decimales(igv);
	var total=inafecta+exonerada+gravada+igv;
	document.getElementById('totalg').value=decimales(total);

	document.getElementById('monto[]').value=decimales(total);
}

function calcularDescuento(dscto)
{
	var totales=$('#totalg').val()-dscto;
	var subtotal=totales/1.18;
	document.getElementById('gravado').value=decimales(subtotal);
	var igv=subtotal*0.18;
	document.getElementById('igv').value=decimales(igv);
	document.getElementById('totalg').value=decimales(totales);
	document.getElementById('monto[]').value=decimales(totales);
}

function inventario(valor,control)
{
  if (control==1 && valor>0) {
      $("#lote").prop('required',true);
  }
  else {
      $("#lote").removeAttr("required");
  }
}

function feliminar()
{
    $("a.elimina").click(function(){
    	$(this).parents("tr").fadeOut("normal", function(){
        	$(this).remove();
        	toastr.error('El item fue eliminado');
        })
   });
};

/*=========================================================================================================================
=                                                    funciones listado                                                    =
=========================================================================================================================*/
function consultaCodigo(event,valor,div,url)
{
    if(event.which === 13){
    	event.preventDefault();
    	if (valor!='') {
      		consultar(url,valor,div);
    	}
    }
}

function productoListado(url,id,estado)
{
	$('#grproducto').html('');
	const data = new FormData();
	data.append('id', id);
	data.append('estado', estado);
	fetch(url, {
	   method: 'POST',
	   body: data
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#grproducto').html('<tr><td colspan="10"><strong>No hay datos de la busqueda</strong></td></tr>');
		}
		else
		{
			var j=1;
			var cadena='';
			var badge,badgee,estado;
			$.each(datos, function(i,item){
				if (parseFloat(item.stock)<=parseFloat(item.mstock)) {badge='danger';} else {badge='success';}
				let surl=url.replace('busListado','establecimiento');
				let eurl=url.replace('busListado','productoi');
				let curl=url.replace('busListado','buscompras');
				let iurl=url.replace('busListado','inventario');
				let lurl=url.replace('busListado','lotes');
				let ourl=url.replace('busListado','deshabilitar');
				let aurl=url.replace('busListado','habilitar');
			    cadena += '<tr>';
				cadena +='<td>'+j+'</td>';
				cadena +='<td>'+item.descripcion+'</td>';
				cadena +='<td>'+item.nlaboratorio+'</td>';
				cadena +='<td>'+item.factor+'</td>';
				cadena +='<td>'+item.rsanitario+'</td>';
				cadena +='<td align="right">'+decimales(item.pcompra)+'</td>';
				cadena +='<td align="center">';
				if (item.canexos>1) {
				cadena +='<button type="button" class="btn btn-'+badge+' btn-sm py-0" onclick="mostrarModal(\''+surl+'/'+item.id+'\',\'bdatos\',\'Stock Establecimiento\')">'+item.stock+'</button>';
				} else {
				cadena +='<h5 class="my-0"><span class="badge badge-'+badge+'">'+item.stock+'</span></h5>';
				}
				cadena +='</td>';
				cadena +='<td align="right">'+decimales(item.pventa)+'</td>';
				cadena +='<td><div class="btn-group">';
				cadena +='<a href="'+eurl+'/'+item.id+'" class="btn btn-warning btn-sm py-0" title="Editar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-edit"></i></a>';
				if (item.estado==1) {
					if (item.tipo=='B') {
					cadena +='<button type="button" class="btn bg-secondary btn-sm py-0" onclick="mostrarModal(\''+iurl+'/'+item.id+'\',\'bdatos\',\'Actualizar Inventario\')"><i class="fa fa-server"></i> </button>';
					}
					if (item.lote==1) {
					cadena +='<button type="button" class="btn bg-purple btn-sm py-0" onclick="mostrarModal(\''+lurl+'/'+item.id+'\',\'bdatos\',\'Datos Lotes\')"><i class="fa fa-cubes"></i> </button>';
					}
					cadena +='<button type="button" class="btn btn-info btn-sm py-0" onclick="mostrarModal(\''+curl+'/'+item.id+'\',\'bdatos\',\'Datos Ultimos Movimientos\')"><i class="fa fa-sync-alt"></i> </button>';
					cadena +='<a href="'+ourl+'/'+item.id+'" class="btn btn-outline-danger btn-sm py-0" data-toggle="tooltip" data-placement="bottom" title="Inactivar"><i class="fa fa-thumbs-down"></i></a>';
				} else {
					cadena +='<a href="'+aurl+'/'+item.id+'" class="btn btn-outline-success btn-sm py-0" data-toggle="tooltip" data-placement="bottom" title="Activar"><i class="fa fa-thumbs-up"></i></a>';
				}
				cadena +='</div></td>';
			  cadena +='</tr>';
				$('#grproducto').html(cadena);
				j++;
			});
		}
	})
	.catch(function(err) {
	   console.log(err);
	});
}

function servicioListado(url,id,estado)
{
	$('#grproducto').html('');
	const data = new FormData();
	data.append('id', id);
	data.append('estado', estado);
	fetch(url, {
	   method: 'POST',
	   body: data
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#grproducto').html('<tr><td colspan="10"><strong>No hay datos de la busqueda</strong></td></tr>');
		}
		else
		{
			var j=1;
			var cadena='';
			var badge,badgee,estado;
			$.each(datos, function(i,item){
				let eurl=url.replace('busListado','productoi');
				let curl=url.replace('busListado','busventas');
				let ourl=url.replace('busListado','deshabilitar');
				let aurl=url.replace('busListado','habilitar');
			    cadena += '<tr>';
				cadena +='<td>'+j+'</td>';
				cadena +='<td>'+item.descripcion+'</td>';
				cadena +='<td align="right">'+decimales(item.pventa)+'</td>';
				cadena +='<td><div class="btn-group">';
				cadena +='<a href="'+eurl+'/'+item.id+'" class="btn btn-warning btn-sm py-0" title="Editar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-edit"></i></a>';
				if (item.estado==1) {
					cadena +='<button type="button" class="btn btn-info btn-sm py-0" onclick="mostrarModal(\''+curl+'/'+item.id+'\',\'bdatos\',\'Datos Ultimos Ventas\')"><i class="fa fa-sync-alt"></i> </button>';
					cadena +='<a href="'+ourl+'/'+item.id+'" class="btn btn-outline-danger btn-sm py-0" data-toggle="tooltip" data-placement="bottom" title="Inactivar"><i class="fa fa-thumbs-down"></i></a>';
				} else {
					cadena +='<a href="'+aurl+'/'+item.id+'" class="btn btn-outline-success btn-sm py-0" data-toggle="tooltip" data-placement="bottom" title="Activar"><i class="fa fa-thumbs-up"></i></a>';
				}
				cadena +='</div></td>';
			  cadena +='</tr>';
				$('#grproducto').html(cadena);
				j++;
			});
		}
	})
	.catch(function(err) {
	   console.log(err);
	});
}

function envioFormulario(url)
{
	event.preventDefault();

	Swal.fire({
		title: "Desea guardar la informacion?",
		text: "No podras revertir esto!",
		type: "warning",
		showCancelButton: true,
		confirmButtonText: "Si, guardar esto!",
		cancelButtonText: "No, cancelar!",
		confirmButtonColor: '#3085d6',
		cancelButtonColor: '#d33',
	}).then((result) => {
		if (result.value) {
			document.getElementById("btsubmit").value = "Enviando...";
			document.getElementById("btsubmit").disabled = true;

			$.ajax({
				url: url,
				type: 'POST',
				async:true,
				data: $('#form1').serialize(),
				success: function(responder) {
					console.log(responder);
					var dato = JSON.parse(responder);
					if (dato.url!='') {
						window.location.href=dato.url;
						toastr.success(dato.mensaje);
					} else {
						toastr.error(dato.mensaje);
						setTimeout(function () {
							document.getElementById("btsubmit").value = "Guardar";
							document.getElementById("btsubmit").disabled = false;
					    }, 800);
					}
				},
				error: function(error) {
					console.log(error);
				}
			});
		}
	})
}

/*=========================================================================================================================
=                                                 funciones bonificaciones                                                =
=========================================================================================================================*/
function consultarb(url)
{
	var a=$('#canuo').val();
	var m=$('#cmes').val();
	$('#grilla').html('');
	$.post(url,{a,m},function(data){
		if (data==0) {
			document.getElementById('tblbonificacion').style.display = 'block';
		} else {
			toastr.error('Ya se ingreso productos bonificados para ese año y mes');
			document.getElementById('tblbonificacion').style.display = 'none';
		}
	});
}

function mostrarb(url)
{
	var a=$('#canuo').val();
	var m=$('#cmes').val();
	$.post(url,{a,m},function(data){
		if (data>0) {
			toastr.error('Ya se ingreso productos bonificados para ese año y mes', '',{"positionClass" : "toast-top-center"});
			$('#cmes').val('');
		}
	});
}

function productoNombreb(url,id)
{
	$('#grproducto').html('');
	const data = new FormData();
	data.append('id', id);

	fetch(url, {
	   method: 'POST',
	   body: data
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
		}
		else
		{
			var cadena='';
			$.each(datos, function(i,item){
				nproducto=item.descripcion;
				if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
				cadena += '<tr>';
				cadena +='<td>'+item.id+'</td>';
				cadena +='<td>'+nproducto+'</td>';
				cadena +='<td align="center">'+item.bonificacion+'</td>';
				cadena +='<td align="center">'+item.stock+'</td>';
				cadena +='<td align="right"><a href="javascript:void(0)" class="btn btn-info btn-sm py-0" onclick="appbonificacion(\''+item.id+'\', \`'+nproducto+'\`);">'+item.pventa+'</a></td>';
				cadena +='</tr>';
				$('#grproducto').html(cadena);
			});
		}
  })
	.catch(function(err) {
	   console.log(err);
	});
}

function appbonificacion(id,nombres)
{
	var nmes=$('#cmes').val();
	if (nmes!='') {
		cadena = '<tr>';
		cadena += '<td><input type="hidden" name="idproducto[]" value="'+id+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
		cadena += '<td><input type="number" min="0.01" step="0.01" name="monto[]" value="" class="form-control form-control-sm"/></td>';
		cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" data-toggle="tooltip" data-placement="bottom" title="Eliminar" data-toggle="tooltip" data-placement="bottom" data-original-title="Eliminar"><i class="fa fa-trash"></i></a></td>';
		cadena += "</tr>";
		$("#grilla").prepend(cadena);
		feliminar();
	} else {
		toastr.error('No selecciono año y mes para la bonificacion');
	}
};

function borrarb(id)
{
	$('#'+id+'').remove();
}

/*=========================================================================================================================
=                                                    funciones ingreso                                                    =
=========================================================================================================================*/
$('#busingreso').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#busingreso').on('hidden.bs.modal', function (e){
	reset_ingreso();
})

function productoNombrei(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblProducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

		        	var nproducto=item.descripcion;
		        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
				    cadena +='<a href="javascript:void(0)" onclick="mingreso(\''+item.id+'\', \`'+nproducto+'\`,\''+item.compra+'\',\''+item.factor+'\',\''+item.lote+'\',\''+url+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+'</dt></a>';
				    cadena +='<hr class="m-0">';
		        	$('#grproducto').html(cadena);
				});
			}
	    })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function mingreso(cod,nom,pre,fac,lote,url)
{
	reset_ingreso();
	$("#munidades").removeClass("is-invalid");
	$("#mcosto").removeClass("is-invalid");
	$("#mlote").removeClass("is-invalid");
	$("#mfecha").removeClass("is-invalid");

	document.getElementById('mcodigo').value = cod;
	document.getElementById('mdescripcion').value = nom;
	document.getElementById('mfactor').value = fac;
	document.getElementById('munidades').value = 1;
	document.getElementById('mcosto').value = pre;
	document.getElementById('mtotal').value = pre;
	document.getElementById('mcantidad').value = fac*1;
	document.getElementById('mmonto').value = pre/fac;
	document.getElementById('mactivar').value = lote;
	if (lote==1) {
		document.getElementById('mdetalle').style.display = 'block';
	}else{
		document.getElementById('mdetalle').style.display = 'none';
	}

	$('#mmedida').html('');
	if (fac>1) {
		$("#mmedida").append('<option value="BX|'+fac+'|'+pre+'">Caja</option>');
		$("#mmedida").append('<option value="NIU|1|'+pre/fac+'">Unidad</option>');
	}else{
		$("#mmedida").append('<option value="NIU|1|'+pre+'">Unidad</option>');
	}

	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
	document.getElementById('munidades').select();
}

function appingreso()
{
	var codigo=$('#mcodigo').val();
	var nombres=$('#mdescripcion').val();
	var cantidad=$('#munidades').val();
	var precio=$('#mcosto').val();
	var total=$('#mtotal').val();
	var nlote=$('#mlote').val();
	var fechal=$('#mfecha').val();
	var restringir=$('#mactivar').val();
	var factor=$('#mfactor').val();
	var medida=$('#mmedida').val().split('|');

	var almacenc=$('#mcantidad').val();
	var almacenp=$('#mmonto').val();
	if (restringir==1) {
		if(codigo!='' && nombres!='' && cantidad!='' && precio!='' && nlote!=''){
			cadena = '<tr>';
			cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
			cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="fvencimiento[]" value="'+fechal+'" class="campo"/></td>';
			cadena += '<td><input type="hidden" name="almacenc[]" value="'+almacenc+'"/><input type="hidden" name="almacenp[]" value="'+almacenp+'"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo"/></td>';
			cadena += '<td><input type="text" name="precio[]" value="'+decimales(precio)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><input type="text"  name="importe[]" value="'+decimales(total)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
			cadena += "</tr>";
			$("#grilla").prepend(cadena);
			reset_ingreso();
			feliminar();
    		$('#busingreso').modal('hide');
		}else{
			$('#mensajeerror').html('<strong class="text-danger">Falta ingresar datos del producto</strong>');
			if (cantidad=='') {document.getElementById("munidades").className += " is-invalid";}
			if (precio=='') {document.getElementById("mcosto").className += " is-invalid";}
			if (nlote=='') {document.getElementById("mlote").className += " is-invalid";}
		}
	}else{
		if(codigo!='' && nombres!='' && cantidad!='' && precio!=''){
			cadena = '<tr>';
			cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
			cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="fvencimiento[]" value="'+fechal+'" class="campo"/></td>';
			cadena += '<td><input type="hidden" name="almacenc[]" value="'+almacenc+'"/><input type="hidden" name="almacenp[]" value="'+almacenp+'"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo"/></td>';
			cadena += '<td><input type="text" name="precio[]" value="'+decimales(precio)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><input type="text"  name="importe[]" value="'+decimales(total)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
			cadena += "</tr>";
			$("#grilla").prepend(cadena);
			reset_ingreso();
			feliminar();
    		$('#busingreso').modal('hide');
		}
	}
};

function reset_ingreso()
{
	$('#codbarra').val(''); // formulario principal

	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#mfactor').val(1);
	$('#munidades').val('');
	$('#mcosto').val('');
	$('#mtotal').val('');
	$('#mcantidad').val('');
	$('#mmonto').val('');

	$('#mlote').val('');
	$('#mfecha').val('');
	$("#mdescripcion").removeAttr("readonly");
	document.getElementById('mdetalle').style.display = 'none';
	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
}

/*=========================================================================================================================
=                                                    funciones salida                                                    =
=========================================================================================================================*/
$('#bussalida').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#bussalida').on('hidden.bs.modal', function (e){
	reset_salida();
})

function productoNombres(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblProducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

		        	var nproducto=item.descripcion;
		        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
				    cadena +='<a href="javascript:void(0)" onclick="msalida(\''+item.id+'\', \`'+nproducto+'\`,\''+item.venta+'\',\''+item.factor+'\',\''+item.pventa+'\',\''+item.lote+'\',\''+item.stock+'\',\''+url+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+'</dt><dd class="mx-2">Precio Unidad : '+decimales(item.pventa)+' -- Precio Caja : '+decimales(item.venta)+' -- Stock : '+item.stock+'</dd></a>';
				    cadena +='<hr class="m-0">';
		        	$('#grproducto').html(cadena);
				});
			}
	    })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function msalida(id,nom,pre,fac,und,lote,cant,url)
{
	reset_salida();
	$("#munidades").removeClass("is-invalid");
	$("#mcosto").removeClass("is-invalid");
	$("#mlote").removeClass("is-invalid");

	document.getElementById('mcodigo').value = id;
	document.getElementById('mdescripcion').value = nom;
	document.getElementById('mstock').value = cant;
	document.getElementById('mfactor').value = 1;
	document.getElementById('mcosto').value = und;
	document.getElementById('mactivar').value = lote;

	document.getElementById('munidades').value = 1;
	document.getElementById('mtotal').value = 1*und;
	document.getElementById('mcantidad').value = 1;
	document.getElementById('munidades').select();
	if (lote==1) {
		$('#tbLotes').html('');
		document.getElementById('mdetalle').style.display = 'block';

		var lurl=url.replace('busProductos','busLotes');
		var cadena='';
		$.post(lurl,{id},function(data){
			var c = JSON.parse(data);
			$.each(c, function(i,item){
				var valores=item.nlote+'|'+item.stock;
				cadena += '<tr>';
				cadena += '<td><div class="form-check"><label class="form-check-label"><input class="form-check-input nlote" type="checkbox" value="'+valores+'" onclick="marcados(this)">'+item.nlote+'</label><div></td>';
				cadena += '<td>'+item.stock+'</td>';
				cadena += '<td>'+item.fvencimiento+'</td>';
				cadena += "</tr>";
				$('#tbLotes').html(cadena);
			});
		});
	}else{
		document.getElementById('mdetalle').style.display = 'none';
	}

	$('#mmedida').html('');
	if (fac>1) {
		$("#mmedida").append('<option value="NIU|1|'+und+'">Unidad</option>');
		$("#mmedida").append('<option value="BX|'+fac+'|'+pre+'">Caja</option>');
	}else{
		$("#mmedida").append('<option value="NIU|1|'+und+'">Unidad</option>');
	}

	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
	document.getElementById('munidades').select();
}

function appsalida()
{
	var codigo=$('#mcodigo').val();
	var nombres=$('#mdescripcion').val();
	var cantidad=$('#munidades').val();
	var precio=$('#mcosto').val();
	var total=$('#mtotal').val();
	var nlote=$('#clote').val();
	var cstock=parseFloat($('#mstock').val());
	var restringir=$('#mactivar').val();
	var factor=$('#mfactor').val();
	var medida=$('#mmedida').val().split('|');

	var almacenc=$('#mcantidad').val();
	var centregar=parseFloat($('#centregar').val());
	if (restringir==1) {
		if(codigo!='' && nombres!='' && cantidad!='' && precio!='' && nlote!='' && almacenc<=cstock && centregar>=almacenc){
			cadena = '<tr>';
			cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
			cadena += '<td><input type="hidden" name="almacenc[]" value="'+almacenc+'"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo"/></td>';
			cadena += '<td><input type="text" name="precio[]" value="'+decimales(precio)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><input type="text"  name="importe[]" value="'+decimales(total)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
			cadena += "</tr>";
			$("#grilla").prepend(cadena);
			reset_salida();
			feliminar();
    		$('#bussalida').modal('hide');
		}else{
			$('#mensajeerror').html('<strong class="text-danger">Falta ingresar datos del producto</strong>');
			if (cantidad=='') {document.getElementById("munidades").className += " is-invalid";}
			if (precio=='') {document.getElementById("mcosto").className += " is-invalid";}
			if (nlote=='') {$('#mensajeerror').append('<strong class="text-danger"><br>Seleccione un lote</strong>');}
			if (almacenc>cstock) {$('#mensajeerror').append('<strong class="text-danger"><br>EL stock actual en mucho menor al que desea vender</strong>');}
			if (centregar<almacenc) {$('#mensajeerror').append('<strong class="text-danger"><br>La cantidad de lote seleccionada es mucho menor</strong>');}
		}
	}else{
		if(codigo!='' && nombres!='' && cantidad!='' && precio!='' && almacenc<=cstock){
			cadena = '<tr>';
			cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
			cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
			cadena += '<td><input type="hidden" name="almacenc[]" value="'+almacenc+'"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo"/></td>';
			cadena += '<td><input type="text" name="precio[]" value="'+decimales(precio)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><input type="text"  name="importe[]" value="'+decimales(total)+'" class="campo" onkeydown="return false"/></td>';
			cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
			cadena += "</tr>";
			$("#grilla").prepend(cadena);
			reset_salida();
			feliminar();
    		$('#bussalida').modal('hide');
		}else{
			if (almacenc>cstock) {$('#mensajeerror').html('<strong class="text-danger">EL stock actual en mucho menor al que desea vender</strong>');}
		}
	}
};

function reset_salida()
{
	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#mfactor').val(1);
	$('#mstock').val('');
	$('#munidades').val('');
	$('#mcosto').val('');
	$('#mtotal').val('');
	$('#mcantidad').val('');

	$('#mdescuento').val('');
	$('#centregar').val(0);
	$('#clote').val('');
	$("#mdescripcion").removeAttr("readonly");
	$('#tbLotes').html('');
	document.getElementById('mdetalle').style.display = 'none';
	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
}

function marcados(nvalor)
{
	let numerosl = [];
	let cantidades=0;
	let cpedido=parseFloat($('#mcantidad').val());
	let cactual=parseFloat($('#centregar').val());

	if (nvalor.checked) {
		if (cpedido>=cactual) {
			$(".nlote:checked").each(function(){
				var valor=this.value.split('|');
			    numerosl.push(valor[0]);
			    cantidades+=parseFloat(valor[1]);
			});

			document.getElementById('clote').value=numerosl;
			document.getElementById('centregar').value=cantidades;
		}
		else {
			nvalor.checked=0;
		}
	}else{
		$(".nlote:checked").each(function(){
			var valor=this.value.split('|');
		    numerosl.push(valor[0]);
		    cantidades+=parseFloat(valor[1]);
		});

		document.getElementById('clote').value=numerosl;
		document.getElementById('centregar').value=cantidades;
	}
}

/*=========================================================================================================================
=                                                   funciones inventario                                                  =
=========================================================================================================================*/
$('#busproductosu').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#busproductosu').on('hidden.bs.modal', function (e){
	reset_inventario();
})

function productoNombreu(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblproducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

		        	var nproducto=item.descripcion;
		        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
				    cadena +='<a href="javascript:void(0)" onclick="minventario(\''+item.id+'\', \`'+nproducto+'\`,\''+item.stock+'\',\''+item.lote+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+' -- Stock : '+item.stock+'</dt></a>';
				    cadena +='<hr class="m-0">';
		        	$('#grproducto').html(cadena);
				});
			}
	    })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function minventario(cod,nom,stock,lote)
{
	reset_inventario();
	$("#munidades").removeClass("is-invalid");

	document.getElementById('mcodigo').value = cod;
	document.getElementById('mdescripcion').value = nom;
	document.getElementById('munidades').value = 1;
	document.getElementById('mactivar').value = lote;
	document.getElementById('mstock').value = stock;

	if (lote==1) {
		document.getElementById('mdetalle').style.display = 'block';
		$("#mlote").prop('required',true);
	}else{
		document.getElementById('mdetalle').style.display = 'none';
        $("#mlote").removeAttr("required");
	}

	$('#grproducto').html('');
	document.getElementById('tblproducto').style.display = 'none';
	document.getElementById('munidades').select();
}

function productoBarrau(event,url,id)
{
	if(event.which === 13){
		event.preventDefault();
		if (id!='') {
			$.post(url,{id},function(responder){
				if (responder=='null') {
					toastr.error('El codigo no existe');
				} else {
	  			//console.log(responder);
					var item=JSON.parse(responder);
					$('#busproductosu').modal('show');
					$("#mdescripcion").prop('readonly',true);
					var nproducto=item.descripcion;
					if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
					document.getElementById('mcodigo').value=item.id;
					document.getElementById('mdescripcion').value=nproducto;
					document.getElementById('munidades').value = 1;
					document.getElementById('mactivar').value = item.lote;
					document.getElementById('mstock').value = item.stock;
					document.getElementById('munidades').select();
					if (item.lote==1) {
						document.getElementById('mdetalle').style.display = 'block';
					}else{
						document.getElementById('mdetalle').style.display = 'none';
					}
				}
			});
		}
	}
}

function reset_inventario()
{
	$('#codbarra').val(''); // formulario principal
	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#munidades').val('');
	$('#mlote').val('');
	$('#mfecha').val('');
	$("#mdescripcion").removeAttr("readonly");
	$('#grproducto').html('');
	document.getElementById('tblproducto').style.display = 'none';
}

/*=========================================================================================================================
=                                                     funciones lotes                                                     =
=========================================================================================================================*/
$('#buslotes').on('hidden.bs.modal', function (e){
	reset_lotes();
})

function mlotes(id,nro,url)
{
	$('#buslotes').modal('show');
	document.getElementById('orden').value=nro;
	var cadena='';
	$.post(url,{id},function(data){
		var c = JSON.parse(data);
		$.each(c, function(i,item){
			var valores=item.nlote+'|'+item.stock;
			cadena += '<tr>';
			cadena += '<td><div class="form-check"><label class="form-check-label"><input class="form-check-input numerol" type="checkbox" value="'+valores+'" onclick="marcadol(this)">'+item.nlote+'</label><div></td>';
			cadena += '<td>'+item.stock+'</td>';
			cadena += '<td>'+item.fvencimiento+'</td>';
			cadena += "</tr>";
			$('#tblote').html(cadena);
		});
	});
}

function marcadol(nvalor)
{
	let numerosl = [];
	let cantidades=0;
	let numeracion = $('#orden').val();
	let cpedido=parseFloat($('#mcantidad'+numeracion+'').val());
	let cactual=parseFloat($('#lentregar').val());

	if (nvalor.checked) {
		if (cpedido>cactual) {
			$(".numerol:checked").each(function(){
				var valor=this.value.split('|');
			    numerosl.push(valor[0]);
			    cantidades+=parseFloat(valor[1]);
			});

			document.getElementById('rlote').value=numerosl;
			document.getElementById('lentregar').value=cantidades;
		}
		else {
			nvalor.checked=0;
		}
	}else{
		$(".nlote:checked").each(function(){
			var valor=this.value.split('|');
		    numerosl.push(valor[0]);
		    cantidades+=parseFloat(valor[1]);
		});

		document.getElementById('rlote').value=numerosl;
		document.getElementById('lentregar').value=cantidades;
	}
}

function applotes()
{
	let numeracion = $('#orden').val();
	let lotes = $('#rlote').val();
	let stock = $('#lentregar').val();
	document.getElementById('mlote'+numeracion+'').value=lotes;
	reset_lotes();
	$('#buslotes').modal('hide');
}

function reset_lotes()
{
	$('#orden').val('');
	$('#rlote').val('');
	$('#lentregar').val(0);
	$('#tblote').html('');
}

/*=======================================================================================================================
=                                                    funciones proveedor                                                =
=======================================================================================================================*/
function bproveedor(event,url,id)
{
	if(event.which === 13){
		event.preventDefault();
		$.ajax({
			url: url,
			type: 'POST',
			async:true,
			data: { id : id },
			success: function(responder) {
				if (id.length==11) {tipo='empresa';}else{tipo='proveedor';}

				var item=JSON.parse(responder);
				if (item==null)
				{
					$("#documento").val('');
					$("#nombres").val('');
					if (tipo=='empresa') {
						mostrarProveedor('../compra/proveedori',tipo,'Datos de la Proveedor');
					} else {
						mostrarProveedor('../compra/proveedori',tipo,'Datos del Proveedor');
					}
				}
				else
				{
					if (tipo=='empresa') {
						document.getElementById('idproveedor').value = item.id;
			        	document.getElementById('proveedor').value = item.nombres;
			        	// document.getElementById('comprobante').value='01';
			        	// $('#comprobante').change();
			        } else {
						document.getElementById('idproveedor').value = item.id;
						document.getElementById('proveedor').value = item.nombres;
					}
				}
			},
			error: function(error) {
				console.log(error);
			}
		});
	}
}

function mostrarProveedor(url,tipo,title)
{
	$("#registroTitle").html(title);
	if(tipo=='empresa') {
		var identidad= 6;
		var numero= $("#dni").val();
	} else if(tipo=='nuevo') {
		var identidad= 6;
		var numero= '';
	} else {
		var identidad= 1;
		var numero= $("#dni").val();
	}
	$.post(url,{identidad,numero},function(resp){
		$("#bregistro").html(resp);
	});
	$('#busregistro').modal('show');
}

function envioProveedor(url)
{
	event.preventDefault();
	$.ajax({
		url: url,
		type: 'POST',
		async:true,
		data: $('#fdatos').serialize(),
		success: function(responder) {
			var c = JSON.parse(responder);
			if (c.success) {
				var item = c.data;
				document.getElementById('idproveedor').value=item.idproveedor;
				document.getElementById('proveedor').value=item.proveedor;
			} else {
				toastr.error(c.data);
			}
		},
		error: function(error) {
			console.log(error);
		}
	});
	$('#busregistro').modal('hide');
}

function proveedorNombre(url,id)
{
	document.getElementById('tblproveedor').style.display = 'block';
	$('#grproveedor').html('');
	if (id.length>2) {
		$.ajax({
			url: url,
			type: 'POST',
			async:true,
			data: { id : id },
			success: function(responder) {
				var datos=JSON.parse(responder);
				if (datos.length==0)
				{
					$('#grproveedor').html('<strong>No hay datos de la busqueda</strong>');
				}
				else
				{
					var cadena='';
					$.each(datos, function(i,item){
			        	var ant=i-1;
						var pos=i+1;
						var anterior='input'+ant;
						var posterior='input'+pos;
					    cadena +='<a href="javascript:void(0)" onclick="datosProveedor(\''+item.id+'\', \`'+item.nombres+'\`, \''+item.documento+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+item.documento+' - '+item.nombres+'</dt></a>';
					    cadena +='<hr class="m-0">';
			        	$('#grproveedor').html(cadena);
					});
				}
			},

			error: function(error) {
				console.log(error);
			}
		});
	} else {
		$('#grproveedor').html('');
		document.getElementById('tblproveedor').style.display = 'none';
	}
}

function datosProveedor(cod,nom,dni)
{
	document.getElementById('idproveedor').value = cod;
	document.getElementById('proveedor').value = nom;
	document.getElementById('dni').value = dni;
	$('#grproveedor').html('');
	document.getElementById('tblproveedor').style.display = 'none';
}

/*=======================================================================================================================
=                                                    funciones solicitud                                                =
=======================================================================================================================*/
$('#bussolicitud').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#bussolicitud').on('hidden.bs.modal', function (e){
	reset_solicitud();
})

function productoNombret(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblProducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

        	var nproducto=item.descripcion;
        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
        	cadena +='<a href="javascript:void(0)" onclick="msolicitud(\''+item.id+'\', \`'+nproducto+'\`,\''+item.factor+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+'</dt></a>';
        	$('#grproducto').html(cadena);
				});
			}
	  })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function msolicitud(cod,nom,fac)
{
	reset_solicitud();
	document.getElementById('mcodigo').value = cod;
	document.getElementById('mdescripcion').value = nom;
	$('#mmedida').html('');
	if (fac>1) {
		$("#mmedida").append('<option value="NIU|1">Unidad</option>');
		$("#mmedida").append('<option value="BX|'+fac+'">Caja</option>');
	}else{
		$("#mmedida").append('<option value="NIU|1">Unidad</option>');
	}

	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
	document.getElementById('munidades').select();
}

function appsolicitud()
{
	var codigo=$('#mcodigo').val();
	var nombres=$('#mdescripcion').val();
	var cantidad=$('#munidades').val();
	var medida=$('#mmedida').val().split('|');

	if(codigo!='' && nombres!='' && cantidad!=''){
		cadena = '<tr>';
		cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
		cadena += '<td><input type="hidden" name="factor[]" value="'+medida[1]+'"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/></td>';
		cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo"/></td>';
		cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
		cadena += "</tr>";
		$("#grilla").prepend(cadena);
		reset_solicitud();
		feliminar();
		$('#bussolicitud').modal('hide');
	}
};

function reset_solicitud()
{
	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#munidades').val('');
	$('#mmedida').val('');
	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
}

/*=======================================================================================================================
=                                                     funciones compras                                                 =
=======================================================================================================================*/
$('#buscompra').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#buscompra').on('hidden.bs.modal', function (e){
	reset_compra();
})

function productoNombrec(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblProducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

		        	var nproducto=item.descripcion;
		        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
		        	cadena +='<a href="javascript:void(0)" onclick="mcompra(\''+item.id+'\', \`'+nproducto+'\`,\''+item.compra+'\',\''+item.factor+'\',\''+item.lote+'\',\''+url+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+'</dt></a>';
				    cadena +='<hr class="m-0">';
		        	$('#grproducto').html(cadena);
				});
			}
	    })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function mcompra(cod,nom,pre,fac,lote,url)
{
	reset_compra();
	$("#munidades").removeClass("is-invalid");
	$("#mcosto").removeClass("is-invalid");
	$("#mlote").removeClass("is-invalid");
	$("#mfecha").removeClass("is-invalid");

	document.getElementById('mcodigo').value = cod;
	document.getElementById('mdescripcion').value = nom;
	document.getElementById('mfactor').value = fac;
	document.getElementById('munidades').value = 1;
	document.getElementById('mcosto').value = pre;
	document.getElementById('mtotal').value = pre;
	document.getElementById('mcantidad').value = fac*1;
	document.getElementById('mmonto').value = pre/fac;
	document.getElementById('mactivar').value = lote;
	if (lote==1) {
		document.getElementById('mdetalle').style.display = 'block';
	}else{
		document.getElementById('mdetalle').style.display = 'none';
	}

	$('#mmedida').html('');
	if (fac>1) {
		$("#mmedida").append('<option value="BX|'+fac+'|'+pre+'">Caja</option>');
		$("#mmedida").append('<option value="NIU|1|'+pre/fac+'">Unidad</option>');
	}else{
		$("#mmedida").append('<option value="NIU|1|'+pre+'">Unidad</option>');
	}

	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
	document.getElementById('munidades').select();
}

function appcompra()
{
	var codigo=$('#mcodigo').val();
	var nombres=$('#mdescripcion').val();
	var cantidad=$('#munidades').val();
	var precio=$('#mcosto').val();
	var total=$('#mtotal').val();
	var nlote=$('#mlote').val();
	var fechal=$('#mfecha').val();
	var restringir=$('#mactivar').val();
	var factor=$('#mfactor').val();
	var medida=$('#mmedida').val().split('|');

	var almacenc=$('#mcantidad').val();
	var almacenp=$('#mmonto').val();
	if (restringir==1) {
		if(codigo!='' && nombres!='' && cantidad!='' && precio!='' && nlote!=''){
			cadena = '<tr>';
			cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
			cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="fvencimiento[]" value="'+fechal+'" class="campo"/></td>';
			cadena += '<td><input type="hidden" name="factor[]" value="'+factor+'" class="factores"/><input type="hidden" name="almacenc[]" value="'+almacenc+'" class="calmacens"/><input type="hidden" name="almacenp[]" value="'+almacenp+'" class="palmacenes"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo unidades"/></td>';
			cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo cantidades"/></td>';
			cadena += '<td><input type="text" name="precio[]" value="'+decimales(precio)+'" class="campo precios"/></td>';
			cadena += '<td><input type="text"  name="importe[]" value="'+decimales(total)+'" class="campo text-right importes"/></td>';
			cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 eliminac" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
			cadena += '</tr>';
			$("#grilla").append(cadena);

			//suamr todos los totales
			calcularCompra();
			reset_compra();
			fceliminar();
    		$('#buscompra').modal('hide');
		}else{
			$('#mensajeerror').html('<strong class="text-danger">Falta ingresar datos del producto</strong>');
			if (cantidad=='') {document.getElementById("munidades").className += " is-invalid";}
			if (precio=='') {document.getElementById("mcosto").className += " is-invalid";}
			if (nlote=='') {document.getElementById("mlote").className += " is-invalid";}
		}
	}else{
		if(codigo!='' && nombres!='' && cantidad!='' && precio!=''){
			cadena = '<tr>';
			cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo" readonly /></td>';
			cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
			cadena += '<td><input type="text" name="fvencimiento[]" value="'+fechal+'" class="campo"/></td>';
			cadena += '<td><input type="hidden" name="factor[]" value="'+medida[1]+'" class="factores"/><input type="hidden" name="almacenc[]" value="'+almacenc+'" class="calmacens"/><input type="hidden" name="almacenp[]" value="'+almacenp+'" class="palmacenes"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo unidades"/></td>';
			cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo cantidades"/></td>';
			cadena += '<td><input type="text" name="precio[]" value="'+decimales(precio)+'" class="campo precios"/></td>';
			cadena += '<td><input type="text"  name="importe[]" value="'+decimales(total)+'" class="campo text-right importes"/></td>';
			cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 eliminac" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
			cadena += '</tr>';
			$("#grilla").append(cadena);

			//suamr todos los totales
			calcularCompra();
			reset_compra();
			fceliminar();
    		$('#buscompra').modal('hide');
		}
	}
};

function reset_compra()
{
	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#munidades').val('');
	$('#mcosto').val('');
	$('#mtotal').val('');
	$('#mmedida').val('');

	$('#mlote').val('');
	$('#mfecha').val('');
	$("#mdescripcion").removeAttr("readonly");
	document.getElementById('mdetalle').style.display = 'none';
	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
}

function fceliminar()
{
	$("a.eliminac").click(function(){
		$(this).parents("tr").fadeOut("normal", function(){
			$(this).remove();
			calcularCompra();
			toastr.error('El producto fue eliminado');
		})
	});
};

function productoBarrac(event,url,id)
{
	if(event.which === 13){
		event.preventDefault();
		if (id!='') {
			$.post(url,{id},function(responder){
				if (responder=='null') {
					toastr.error('El codigo de barra no existe');
				} else {
      			//console.log(responder);
					var item=JSON.parse(responder);
					$('#buscompra').modal('show');
					$("#mdescripcion").prop('readonly',true);

					var nproducto=item.descripcion;
					if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
					document.getElementById('mcodigo').value=item.id;
					document.getElementById('mdescripcion').value=nproducto;
					document.getElementById('mfactor').value = item.factor;
					document.getElementById('munidades').value = 1;
					document.getElementById('mcosto').value = item.compra;
					document.getElementById('mtotal').value = item.compra;
					document.getElementById('mcantidad').value = 1*item.factor;
					document.getElementById('mmonto').value = item.compra/item.factor;
					document.getElementById('mactivar').value = item.lote;
					if (item.lote==1) {
						document.getElementById('mdetalle').style.display = 'block';
					}else{
						document.getElementById('mdetalle').style.display = 'none';
					}

					$('#mmedida').html('');
					if (item.factor>1) {
						$("#mmedida").append('<option value="BX|'+item.factor+'">Caja</option>');
						$("#mmedida").append('<option value="NIU|1">Unidad</option>');
					}else{
						$("#mmedida").append('<option value="NIU">Unidad</option>');
					}
					document.getElementById('munidades').select();
				}
			});
		}
		$('#bcodigo').val('');
		$('#codbarra').val('');
		$('#codbarra').focus();
	}
}

function calcularc()
{
	$('input.cantidades').keyup(function(){
		unidad = $(this).parents('tr').find('.unidades').val();
		factor = $(this).parents('tr').find('.factores').val();
		cantidad = $(this).val();
		precio = $(this).parents('tr').find('.precios').val();
		importe = cantidad*precio;
		if (unidad=='BX') {
			almacenc=cantidad*factor;
		} else {
			almacenc=cantidad;
		}
		$(this).parents('tr').find('.calmacens').val(almacenc);
		$(this).parents('tr').find('.importes').val(decimales(importe));

		calcularCompra();
	});

	$('input.precios').keyup(function(){
		unidad = $(this).parents('tr').find('.unidades').val();
		factor = $(this).parents('tr').find('.factores').val();
		cantidad = $(this).parents('tr').find('.cantidades').val();
		precio = $(this).val();
		importe = cantidad*precio;
		if (unidad=='BX') {
			almacenp=precio/factor;
		} else {
			almacenp=precio;
		}
		$(this).parents('tr').find('.palmacenes').val(decimales(almacenp));
		$(this).parents("tr").find('.importes').val(decimales(importe));

		calcularCompra();
	});
}

function pagoCreditoc(valor)
{
	if (valor==1) {
		document.getElementById('contado').style.display = 'block';
	}else{
		document.getElementById('contado').style.display = 'none';
	}
}

/*======================================================================================================================
=                                                     funciones producto                                                 =
======================================================================================================================*/
function envioProducto(url)
{
	event.preventDefault();
	$.ajax({
		url: url,
		type: 'POST',
		async:true,
		data: $('#fdatos').serialize(),
		success: function(responder) {
			var c = JSON.parse(responder);
			if (c.success) {
				toastr.success(c.mensaje);
			} else {
				toastr.error(c.mensaje);
			}
		},
		error: function(error) {
			console.log(error);
		}
	});
	$('#busdatos').modal('hide');
}

/*=======================================================================================================================
=                                                    funciones clientes                                                 =
=======================================================================================================================*/
function clienteListado(url,id)
{
	$('#grcliente').html('');
	const data = new FormData();
	data.append('id', id);
	fetch(url, {
	   method: 'POST',
	   body: data
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		console.log(datos);
		if (datos.length==0)
		{
			$('#grcliente').html('<tr><td colspan="7"><strong>No hay datos de la busqueda</strong></td></tr>');
		}
		else
		{
			var j=1;
			var cadena='';
			$.each(datos, function(i,item){
				let eurl=url.replace('busCliente','clientei');
				let purl=url.replace('busCliente','pacumulados');
				let durl=url.replace('busCliente','cliented');
				let iurl=url.replace('busCliente','');
			    cadena += '<tr>';
				cadena +='<td>'+item.id+'</td>';
				cadena +='<td>'+item.nombres+'</td>';
				cadena +='<td>'+item.documento+'</td>';
				cadena +='<td>'+item.telefono+'</td>';
				cadena +='<td>'+item.email+'</td>';
				cadena +='<td>'+item.direccion+'</td>';
				cadena +='<td><div class="btn-group">';
				if (item.id>1) {
				cadena +='<button type="button" class="btn btn-warning btn-sm py-0" onclick="mostrarModal(\''+eurl+'/'+item.id+'\',\'bdatos\')" title="Editar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-edit"></i></button>';
				cadena +='<a href="'+purl+'/'+item.id+'" class="btn btn-info btn-sm py-0" title="Puntos Acumulados" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-plus-circle"></i></a>';
				cadena +='<a href="javascript:void(0)" onclick="borrar(\''+durl+'/'+item.id+'\',\''+item.nombres+'\',\''+iurl+'\')" class="btn btn-danger btn-sm py-0" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a>';
				}
				cadena +='</div></td>';
			  cadena +='</tr>';
				$('#grcliente').html(cadena);
				j++;
			});
		}
	})
	.catch(function(err) {
	   console.log(err);
	});
}

function bcliente(event,url,id,envio)
{
	if(event.which === 13){
		event.preventDefault();
		$.ajax({
			url: url,
			type: 'POST',
			async:true,
			data: {id : id},
			success: function(responder) {
				if (id.length==11) {tipo='empresa';}else{tipo='cliente';}

				var item=JSON.parse(responder);
				if (item==null)
				{
					$("#documento").val('');
					$("#nombres").val('');
					if (tipo=='empresa') {
						mostrarCliente('../nventa/clientei',tipo,'Datos de la Empresa');
					} else {
						mostrarCliente('../nventa/clientei',tipo,'Datos del Cliente');
					}
				}
				else
				{
					if (tipo=='empresa') {
						document.getElementById('idcliente').value = item.id;
			      document.getElementById('cliente').value = item.nombres;
							document.getElementById('tdocumento').value = item.tdocumento;
			    } else {
						document.getElementById('idcliente').value = item.id;
						document.getElementById('cliente').value = item.nombres;
						document.getElementById('tdocumento').value = item.tdocumento;
						if (envio=='V') {
							$('#puntaje').html(item.puntos);
						}
					}
				}
			},
			error: function(error) {
				console.log(error);
			}
		});
	}
}

function mostrarCliente(url,tipo,title)
{
	$("#registroTitle").html(title);
	if(tipo=='empresa') {
		var identidad= 6;
		var numero= $("#dni").val();
	} else if(tipo=='nuevo') {
		var identidad= 1;
		var numero= '';
	} else {
		var identidad= 1;
		var numero= $("#dni").val();
	}
	$.post(url,{identidad,numero},function(resp){
		$("#bregistro").html(resp);
	});
	$('#busregistro').modal('show');
}

function envioCliente(url)
{
	event.preventDefault();
	$.ajax({
		url: url,
		type: 'POST',
		async:true,
		data: $('#fdatos').serialize(),
		success: function(responder) {
			var c = JSON.parse(responder);
			if (c.success) {
				var item = c.data;
				document.getElementById('idcliente').value=item.idcliente;
				document.getElementById('tdocumento').value = item.tdocumento;
				document.getElementById('dni').value = item.documento;
				document.getElementById('cliente').value=item.cliente;
				// $('#puntaje').html(item.puntos);
			} else {
				toastr.error(c.data);
			}
		},
		error: function(error) {
			console.log(error);
		}
	});
	$('#busregistro').modal('hide');
}

function clienteNombre(url,id,envio)
{
	document.getElementById('tblcliente').style.display = 'block';
	$('#grcliente').html('');
	if (id.length>2) {
		$.ajax({
			url: url,
			type: 'POST',
			async:true,
			data: { id : id },
			success: function(responder) {
				var datos=JSON.parse(responder);
				if (datos.length==0)
				{
					$('#grcliente').html('<strong>No hay datos de la busqueda</strong>');
				}
				else
				{
					var cadena='';
					$.each(datos, function(i,item){
			        	var ant=i-1;
						var pos=i+1;
						var anterior='input'+ant;
						var posterior='input'+pos;
					    cadena +='<a href="javascript:void(0)" onclick="datosCliente(\''+item.id+'\', \`'+item.nombres+'\`, \''+item.documento+'\', \''+item.tdocumento+'\', \''+item.puntos+'\', \''+envio+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+item.documento+' - '+item.nombres+'</dt></a>';
					    cadena +='<hr class="m-0">';
			        	$('#grcliente').html(cadena);
					});
				}
			},

			error: function(error) {
				console.log(error);
			}
		});
	} else {
		$('#grcliente').html('');
		document.getElementById('tblcliente').style.display = 'none';
	}
}

function datosCliente(cod,nom,dni,tipo,punto,envio)
{
	document.getElementById('idcliente').value = cod;
	document.getElementById('cliente').value = nom;
	document.getElementById('dni').value = dni;
	document.getElementById('tdocumento').value = tipo;
	if (envio=='V') {
		$('#puntaje').html(punto);
	}
	$('#grcliente').html('');
	document.getElementById('tblcliente').style.display = 'none';
}

function mostrarDescuento(valor)
{
	if (valor.checked) {
		var cliente=$('#idcliente').val();
		var tidentidad=$('#tdocumento').val();
		var totales=0;
		var contador = document.getElementsByName("dscto[]").length;
	  for(i=0;i<contador;i++){
			if (!isNaN(parseFloat(document.getElementsByName("dscto[]")[i].value))) totales += parseFloat(document.getElementsByName("dscto[]")[i].value);
	  }

		$('#nvale').val('');
		$('#mdscto').val('');
		if (totales==0 && cliente>1 && tidentidad!=6) {
			document.getElementById('cvale').style.display = 'block';
		} else {
			document.getElementById('cvale').style.display = 'none';
		}
	} else {
		$('#nvale').val('');
		$('#mdscto').val('');
		document.getElementById('cvale').style.display = 'none';
	}
}

function validarVale(url)
{
	var id= $("#nvale").val();
	$.post(url,{id},function(data){
		//console.log(data);
		var c = JSON.parse(data);

		if (c.tipo==1) {
			toastr.error(c.mensaje);
		} else {
			toastr.success(c.mensaje);
		}

		let descuento=c.importe;
		if (descuento>0) {
			document.getElementById('mdsctog').value=descuento;
			calcularDescuento(descuento);
		} else {
			$('#mdsctog').val('');
		}
	});
}

function limpiarVale()
{
	$('#nvale').val('');
	$('#mdsctog').val('');
	calcularVenta();
}

/*=========================================================================================================================
=                                                      funciones cotizacion                                                   =
=========================================================================================================================*/
function productoNombren(url,id)
{
	$('#bcodigo').val('');
	$('#grproducto').html('');
	const data = new FormData();
	data.append('id', id);

	fetch(url, {
		method: 'POST',
		body: data
	})
	.then(function(response) {
		if(response.ok) {
			return response.json();
		} else {
			throw "Error en la llamada Ajax";
		}
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
		}
		else
		{
			var cadena='';
			$.each(datos, function(i,item){
				let durl=url.replace('busProductos','busPrincipio');
				var nproducto=item.descripcion;
		        if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
				if (item.stock>0) {
					cadena += '<tr>';
				}
				else {
					cadena += '<tr style="color: #dc3545;">';
				}
				cadena +='<td class="priority">'+item.id+'</td>';
				cadena +='<td>'+nproducto+'</td>';
				cadena +='<td class="priority" align="center"><b>'+item.factor+'</b></td>';
				cadena +='<td align="center">'+item.stock+'</td>';
				cadena +='<td align="right"><a href="javascript:void(0)" class="btn btn-info btn-sm py-0" onclick="appcotizacion(\''+item.id+'\', \`'+nproducto+'\`,\'NIU\',\'1\',\''+item.tafectacion+'\',\''+item.pventa+'\',\''+item.stock+'\');">'+item.pventa+'</a></td>';
				cadena +='<td align="right">';
				if (item.factorb>1) {
				cadena +='<a href="javascript:void(0)" class="btn btn-primary btn-sm py-0" onclick="appcotizacion(\''+item.id+'\', \`'+nproducto+' BLISTER X '+item.factorb+'\`,\'BL\','+item.factorb+',\''+item.tafectacion+'\',\''+item.pblister+'\',\''+item.stock+'\');">'+item.pblister+'</a>';
				}
				cadena +='</td>';
				cadena +='<td align="right">';
				if (item.factor>1) {
				cadena +='<a href="javascript:void(0)" class="btn btn-success btn-sm py-0" onclick="appcotizacion(\''+item.id+'\', \`'+nproducto+' CJ X '+item.factor+'\`,\'BX\','+item.factor+',\''+item.tafectacion+'\',\''+item.venta+'\',\''+item.stock+'\');">'+item.venta+'</a>';
				}
				cadena +='</td>';
				cadena +='</tr>';
				$('#grproducto').html(cadena);
			});
		}
	})
	.catch(function(err) {
		console.log(err);
	});
}

function appcotizacion(id,producto,unidad,factor,afectacion,precio,stock)
{
	verificar=cantidadProducto('productoc');
	if (verificar.includes(id)) {
    nro = verificar.indexOf(id);
    factori=document.getElementsByClassName('factorc')[nro].value;
    if (factor!=factori) {
    	toastr.info('No es la misma presentacion del producto debe cambiarla', '',{"positionClass" : "toast-top-center"});
    } else {
	    cantidad=parseFloat(document.getElementsByClassName('cantidadc')[nro].value)+1;
	    document.getElementsByClassName('cantidadc')[nro].value = cantidad;
	    precio=document.getElementsByClassName('precioc')[nro].value;
			almacenc=cantidad*factor;
			importe = cantidad*precio;
			document.getElementsByClassName('calmacenc')[nro].value = almacenc;
			document.getElementsByClassName('importec')[nro].value = decimales(importe);
			calcularCotizacion();
	  }
  }else{
		let almacenc=factor*1;
		let mtotal=decimales(precio*1);
		cadena = '<tr>';
		cadena += '<td colspan="2"><input type="text" name="descripcion[]" value="'+producto+'" class="campo" readonly /><input type="hidden" name="idproducto[]" value="'+id+'" class="productoc"/>';
		cadena += '<div class="row"><div class="col-sm-3"><input type="hidden" class="calmacenc" name="almacenc[]" value="'+almacenc+'"/><input type="hidden" name="factor[]" id="factor[]" value="'+factor+'" class="factorc"><input type="text" name="unidad[]" value="'+unidad+'" class="campo"/><input type="hidden" name="tafectacion[]" value="'+afectacion+'" class="campo"/></div>';
		cadena += '<div class="col-sm-3"><input type="number" name="cantidad[]" value="1" min="1" class="form-control form-control-sm cantidadc"/></div>';
		cadena += '<div class="col-sm-3"><input type="text" name="precio[]" value="'+precio+'" class="campo text-right precioc" onkeydown="return false"/></div>';
		cadena += '<div class="col-sm-3"><input type="number" min="0.01" step="0.01"  name="importe[]" value="'+mtotal+'" class="campo text-right importec" onkeydown="return false"/></div></div></td>';
		cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
		cadena += "</tr>";
		$("#grilla").prepend(cadena);
		fneliminar();
		calcularn();
		calcularCotizacion();
	}
};

function fneliminar()
{
    $("a.elimina").click(function(){
    	$(this).parents("tr").fadeOut("normal", function(){
      $(this).remove();
			calcularCotizacion();
			toastr.error('El producto fue eliminado');
      })
   });
};

function productoBarran(event,url,id)
{
    if(event.which === 13){
      event.preventDefault();
      if (id!='') {
      	$.post(url,{id},function(responder){
			if (responder=='null') {
				toastr.error('El codigo de barra no existe');
			} else {
  			var item=JSON.parse(responder);
  			verificar=cantidadProducto('productoc');
				if (verificar.includes(id)) {
			    nro = verificar.indexOf(id);
			    factori=document.getElementsByClassName('factorc')[nro].value;
			    if (1!=factori) {
			    	toastr.info('No es la misma presentacion del producto debe cambiarla', '',{"positionClass" : "toast-top-center"});
			    } else {
				    cantidad=parseFloat(document.getElementsByClassName('cantidadc')[nro].value)+1;
				    document.getElementsByClassName('cantidadc')[nro].value = cantidad;

				    precio=document.getElementsByClassName('precioc')[nro].value;
						almacenc=cantidad*1;
						importe = cantidad*precio;
						document.getElementsByClassName('calmacenc')[nro].value = almacenc;
						document.getElementsByClassName('importec')[nro].value = decimales(importe);
						calcularCotizacion();
				  }
			  }else{
	  			var nproducto=item.descripcion;
	        if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
					let almacenc=1;
					let mtotal=decimales(item.pventa*1);
					cadena = '<tr>';
					cadena += '<td colspan="2"><input type="text" name="descripcion[]" value="'+nproducto+'" class="campo" readonly /><input type="hidden" name="idproducto[]" value="'+item.id+'" class="productoc"/>';
					cadena += '<div class="row"><div class="col-sm-3"><input type="hidden" class="calmacenc" name="almacenc[]" value="'+almacenc+'"/><input type="hidden" name="factor[]" id="factor[]" value="1" class="factorc"><input type="text" name="unidad[]" value="NIU" class="campo"/><input type="hidden" name="tafectacion[]" value="'+item.tafectacion+'" class="campo"/></div>';
					cadena += '<div class="col-sm-3"><input type="number" name="cantidad[]" value="1" min="1" class="form-control form-control-sm cantidadc"/></div>';
					cadena += '<div class="col-sm-3"><input type="text" name="precio[]" value="'+item.pventa+'" class="campo text-right precioc"/></div>';
					cadena += '<div class="col-sm-3"><input type="number" min="0.01" step="0.01" name="importe[]" value="'+mtotal+'" class="campo text-right importec" onkeydown="return false"/></div></div></td>';
					cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
					cadena += "</tr>";
					$("#grilla").prepend(cadena);
					fneliminar();
					calcularn();
					calcularCotizacion();
				}
			}
		});
      }else{
      	let durl=url.replace('busCodigobarra','busProductos');
		productoNombren(durl,id);
      }
		$('#bproducto').val('');
		$('#bcodigo').val('');
		$('#codbarra').val('');
		$('#codbarra').focus();
    }
}

function calcularn()
{
	$('input.cantidadc').change(function(){
		id = $(this).parents('tr').find('.productoc').val();
		verificar=cantidadProducto('productoc');
		nro = verificar.indexOf(id);

		factor=document.getElementsByClassName('factorc')[nro].value;
		cantidad = $(this).val();
		precio=document.getElementsByClassName('precioc')[nro].value;
		almacenc=cantidad*factor;
		importe = cantidad*precio;
		document.getElementsByClassName('calmacenc')[nro].value = almacenc;
		document.getElementsByClassName('importec')[nro].value = decimales(importe);
		calcularCotizacion();
	});

	$('input.cantidadc').keyup(function(){
		id = $(this).parents('tr').find('.productoc').val();
		verificar=cantidadProducto('productoc');
		nro = verificar.indexOf(id);

		factor=document.getElementsByClassName('factorc')[nro].value;
		cantidad = $(this).val();
		precio=document.getElementsByClassName('precioc')[nro].value;
		almacenc=cantidad*factor;
		importe = cantidad*precio;
		document.getElementsByClassName('calmacenc')[nro].value = almacenc;
		document.getElementsByClassName('importec')[nro].value = decimales(importe);
		calcularCotizacion();
	});

	$('input.precioc').keyup(function(){
		cantidad = $(this).parents('tr').find('.cantidadc').val();
		precio = $(this).val();
		importe = cantidad*precio;
		$(this).parents('tr').find('.importec').val(decimales(importe));
		calcularCotizacion();
	});
}

function limpiarBuscadorn(url)
{
	$('#bproducto').val('');
	productoNombren(url,'a');
}

function cantidadProducto(claseInput)
{
  var inputs = document.getElementsByClassName(claseInput);
  var valores = [];
  for (var i = 0; i < inputs.length; i++) {
    var valor = inputs[i].value;
    valores.push(valor);
  }
  return valores;
}

/*======================================================================================================================
=                                                     funciones ventas                                                 =
======================================================================================================================*/
function tcomprobante(nro,url)
{
	$.post(url,{nro},function(resp){
		document.getElementById('serie').value=resp;
	});

	if (nro=='01') {
		$('#idcliente').val('');
		$('#cliente').val('');
		$('#dni').val('');
		$('#tdocumento').val('');
	} else {
		$('#idcliente').val('1');
		$('#cliente').val('CLIENTES VARIOS');
		$('#dni').val('');
		$('#tdocumento').val(0);
		$('#puntaje').html('Puntos Acumulados : 0');
	}
	mostrarDescuento();
}

function pcomprobante(nro,url)
{
	$.post(url,{nro},function(resp){
		document.getElementById('serie').value=resp;
	});
}

function productoNombrev(url,id)
{
	$('#codbarra').val('');
	$('#grproducto').html('');
	const data = new FormData();
	data.append('id', id);

	fetch(url, {
	   method: 'POST',
	   body: data
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
		}
		else
		{
			var cadena='';
      $.each(datos, function(i,item){
      	let durl=url.replace('busProductos','busPrincipio');
      	let lurl=url.replace('busProductos','busLotes');
      	var nproducto=item.descripcion;
        if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
	    	if (item.stock<1 && item.tipo=='B') {
	    		colores= '#dc3545';
				} else {
					if (item.bonificacion>0) {colores= '#00c800';} else {colores= '#000000';}
				}
        if (item.vsujeta==1) {tcolor='table-success';} else {tcolor='';}
				cadena += '<tr style="color: '+colores+';" class="'+tcolor+'">';
				cadena +='<td class="priority">'+(item.puntos==1 ? 'PUN': '')+'</td>';
				cadena +='<td><a href="javascript:void(0)" onclick="msimilares(\''+durl+'\',\''+item.id+'\')">'+nproducto+'</a></td>';
				cadena +='<td class="priority"><b>'+item.factor+'</b></td>';
				cadena +='<td class="priority" align="right">'+item.bonificacion+'</td>';
				if (item.lote==1 && item.stock>0) {
				cadena +='<td align="center"><a href="javascript:void(0)" onclick="mvental(\''+item.id+'\',\`'+nproducto+'\`,\''+item.venta+'\','+item.factor+',\''+item.pventa+'\',\''+item.tafectacion+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+lurl+'\')" class="badge badge-dark" style="font-size: 100%;" title="Seleccionar Lotes">'+(item.stock>99 ? '+99': item.stock)+'</a></td>';
				} else {
				cadena +='<td align="center">'+(item.stock>99 ? '+99': item.stock)+'</td>';
				}
				if (item.stock>0 || item.tipo=='S') {
					cadena +='<td align="right"><a href="javascript:void(0)" class="btn btn-info btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+'\`,\'NIU\',\'1\',\''+item.tafectacion+'\',\''+item.pventa+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.pventa+'</a></td>';
						cadena +='<td align="right">';
					if (item.factorb>1 && item.pblister>0 && parseInt(item.stock)>=item.factorb) {
					cadena +='<a href="javascript:void(0)" class="btn btn-primary btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+' BLISTER X '+item.factorb+'\`,\'BL\','+item.factorb+',\''+item.tafectacion+'\',\''+item.pblister+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.pblister+'</a>';
					}
					cadena +='</td>';
					cadena +='<td align="right">';
					if (item.factor>1 && item.venta>0 && parseInt(item.stock)>=item.factor) {
					cadena +='<a href="javascript:void(0)" class="btn btn-success btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+' CJ X '+item.factor+'\`,\'BX\','+item.factor+',\''+item.tafectacion+'\',\''+item.venta+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.venta+'</a>';
					}
					cadena +='</td>';
				} else {
					cadena +='<td align="right">'+item.pventa+'</td>';
					cadena +='<td align="right">'+(item.factorb>1 && item.pblister>0 ? item.pblister : '')+'</td>';
					cadena +='<td align="right">'+(item.factor>1 && item.venta>0 ? item.venta : '')+'</td>';
				}
			  cadena +='</tr>';
	      $('#grproducto').html(cadena);
			});
		}
    })
	.catch(function(err) {
	   console.log(err);
	});
}

function appventa(id,producto,unidad,factor,afectacion,precio,lote,stock,tipo,dscto,edicion,receta)
{
	verificar=cantidadProducto('producton');
	if (verificar.includes(id)) {
    nro = verificar.indexOf(id);
    nlote=document.getElementsByClassName('loten')[nro].value;
    if (nlote!='') {
    	toastr.info('Ya se registro este producto', '',{"positionClass" : "toast-top-center"});
    } else {
	    factori=document.getElementsByClassName('factorn')[nro].value;
	    if (factor!=factori) {
	    	toastr.info('No es la misma presentacion del producto debe cambiarla', '',{"positionClass" : "toast-top-center"});
	    } else {
		    cantidad=parseFloat(document.getElementsByClassName('cantidadn')[nro].value)+1;
		    document.getElementsByClassName('cantidadn')[nro].value = cantidad;

		    tipo = document.getElementsByClassName('tipon')[nro].value;
			  factor=document.getElementsByClassName('factorn')[nro].value;
				precio=document.getElementsByClassName('precion')[nro].value;
				almacenc=cantidad*factor;
				importe = cantidad*precio;
				descuento = document.getElementsByClassName('dscton')[nro].value==0 ? importe*document.getElementsByClassName('porcentajen')[nro].value/100 : document.getElementsByClassName('porcentajen')[nro].value;
				mtotal =importe-descuento;
				document.getElementsByClassName('calmacenn')[nro].value = almacenc;
				document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
				stock = document.getElementsByClassName('stockn')[nro].value;

				if (almacenc>stock && tipo=='B') {
					toastr.error('Stock es mucho menor', '',{"positionClass" : "toast-top-center"});
					document.getElementsByClassName('cantidadn')[nro].value = 1;
					almacenc=1*factor;
					importe = 1*precio;
					mtotal =importe-descuento;
					document.getElementsByClassName('calmacenn')[nro].value = almacenc;
					document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
				}
				calcularVenta();
	    }
    }
  }else{
		if (receta==1) {toastr.info('Este producto necesita receta', '',{"positionClass" : "toast-top-center"});}

		let almacenc=factor*1;
		let mtotal=decimales(precio*1);
		let escondido=dscto==2 ? 'hidden' : 'number';
		let descuento=dscto==0 ? '%' : 'S/.';
		let estilo=edicion==0 ? 'campo' : 'form-control form-control-sm';
		let bloquear=edicion==0 ? 'onkeydown="return false"' : '';
		cadena = '<tr>';
		cadena += '<td colspan="2"><input type="text" name="descripcion[]" value="'+producto+'" class="campo" readonly /><input type="hidden" name="idproducto[]" value="'+id+'" class="producton"/><input type="hidden" class="tipon" name="tipo[]" id="tipo[]" value="'+tipo+'">';
		cadena += '<div class="row"><div class="col-sm-3 col-4"><input type="text" name="nlote[]" value="" class="campo loten"/><input type="hidden" name="lote[]" value="'+lote+'" class="campo"/></div>';
		cadena += '<div class="col-sm-1 col-4"><input type="hidden" class="factorn" name="factor[]" id="factor[]" value="'+factor+'"><input type="text" name="unidad[]" value="'+unidad+'" class="campo"/><input type="hidden" name="tafectacion[]" value="'+afectacion+'"/></div>';
		cadena += '<div class="col-sm-2 col-4"><input type="hidden" name="stock[]" value="'+stock+'" class="stockn"/><input type="number" name="cantidad[]" value="1" min="1" class="form-control form-control-sm cantidadn" onkeypress="return event.keyCode != 13;"/><input type="hidden" class="calmacenn" name="almacenc[]" value="'+almacenc+'"/></div>';
		cadena += '<div class="col-sm-2 col-4"><input type="text" name="precio[]" value="'+precio+'" class="'+estilo+' text-right precion" '+bloquear+'/></div>';
		cadena += '<div class="col-sm-2 col-4"><input type="hidden" class="dscton" name="tdscto[]" id="tdscto[]" value="'+dscto+'"><input type="'+escondido+'" step="0.01" name="dscto[]" value="" class="form-control form-control-sm border border-danger porcentajen" placeholder="('+descuento+')Dscto"/></div>';
		cadena += '<div class="col-sm-2 col-4"><input type="number" min="0.01" step="0.01" name="importe[]" value="'+mtotal+'" class="campo text-right importen" onkeydown="return false"/></div></div></td>';
		cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
		cadena += "</tr>";
		$("#grilla").prepend(cadena);
		fveliminar();
		calcularv();
		calcularVenta();
	}
};

function calcularv()
{
	$('input.cantidadn').change(function(){
		id = $(this).parents('tr').find('.producton').val();
		verificar=cantidadProducto('producton');
		nro = verificar.indexOf(id);

		cantidad = $(this).val();
		tipo = document.getElementsByClassName('tipon')[nro].value;
	  factor=document.getElementsByClassName('factorn')[nro].value;
		precio=document.getElementsByClassName('precion')[nro].value;
		almacenc=cantidad*factor;
		importe = cantidad*precio;
		descuento = document.getElementsByClassName('dscton')[nro].value==0 ? importe*document.getElementsByClassName('porcentajen')[nro].value/100 : document.getElementsByClassName('porcentajen')[nro].value;
		mtotal =importe-descuento;
		document.getElementsByClassName('calmacenn')[nro].value = almacenc;
		document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
		stock = document.getElementsByClassName('stockn')[nro].value;

		if (almacenc>stock && tipo=='B') {
			toastr.error('Stock es mucho menor', '',{"positionClass" : "toast-top-center"});
			document.getElementsByClassName('cantidadn')[nro].value = 1;
			almacenc=1*factor;
			importe = 1*precio;
			mtotal =importe-descuento;
			document.getElementsByClassName('calmacenn')[nro].value = almacenc;
			document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
		}
		calcularVenta();
		$('#cizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	});

	$('input.cantidadn').keyup(function(){
		id = $(this).parents('tr').find('.producton').val();
		verificar=cantidadProducto('producton');
		nro = verificar.indexOf(id);

		cantidad = $(this).val();
		tipo = document.getElementsByClassName('tipon')[nro].value;
	  factor=document.getElementsByClassName('factorn')[nro].value;
		precio=document.getElementsByClassName('precion')[nro].value;
		almacenc=cantidad*factor;
		importe = cantidad*precio;
		descuento = document.getElementsByClassName('dscton')[nro].value==0 ? importe*document.getElementsByClassName('porcentajen')[nro].value/100 : document.getElementsByClassName('porcentajen')[nro].value;
		mtotal =importe-descuento;
		document.getElementsByClassName('calmacenn')[nro].value = almacenc;
		document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
		stock = document.getElementsByClassName('stockn')[nro].value;

		if (almacenc>stock && tipo=='B') {
			toastr.error('Stock es mucho menor', '',{"positionClass" : "toast-top-center"});
			document.getElementsByClassName('cantidadn')[nro].value = 1;
			almacenc=1*factor;
			importe = 1*precio;
			mtotal =importe-descuento;
			document.getElementsByClassName('calmacenn')[nro].value = almacenc;
			document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
		}
		calcularVenta();
		$('#cizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	});

	$('input.porcentajen').change(function(){
		factor = $(this).parents('tr').find('.factorn').val();
		cantidad = $(this).parents('tr').find('.cantidadn').val();
		precio = $(this).parents('tr').find('.precion').val();
		almacenc=cantidad*factor;
		importe = cantidad*precio;
		descuento = $(this).parents('tr').find('.dscton').val()==0 ? importe*$(this).val()/100 : $(this).val();
		mtotal =importe-descuento;
		$(this).parents('tr').find('.calmacenn').val(almacenc);
		$(this).parents('tr').find('.importen').val(decimales(mtotal));

		if (descuento>=importe) {
			toastr.error('El descuento es mayor o igual al importe', '',{"positionClass" : "toast-top-center"});
			$(this).parents('tr').find('.porcentajen').val('');
			$(this).parents('tr').find('.importen').val(decimales(importe));
		}
		calcularVenta();
		mostrarDescuento();
		$('#cizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	});

	$('input.porcentajen').keyup(function(){
		factor = $(this).parents('tr').find('.factorn').val();
		cantidad = $(this).parents('tr').find('.cantidadn').val();
		precio = $(this).parents('tr').find('.precion').val();
		almacenc=cantidad*factor;
		importe = cantidad*precio;
		descuento = $(this).parents('tr').find('.dscton').val()==0 ? importe*$(this).val()/100 : $(this).val();
		mtotal =importe-descuento;
		$(this).parents('tr').find('.calmacenn').val(almacenc);
		$(this).parents('tr').find('.importen').val(decimales(mtotal));

		if (descuento>=importe) {
			toastr.error('El descuento es mayor o igual al importe', '',{"positionClass" : "toast-top-center"});
			$(this).parents('tr').find('.porcentajen').val('');
			$(this).parents('tr').find('.importen').val(decimales(importe));
		}
		calcularVenta();
		mostrarDescuento();
		$('#cizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	});

	$('input.precion').keyup(function(){
		cantidad = $(this).parents('tr').find('.cantidadn').val();
		precio = $(this).val();
		descuento = $(this).parents('tr').find('.porcentajen').val();
		importe = cantidad*precio;
		mtotal =importe-descuento;
		$(this).parents('tr').find('.importen').val(decimales(mtotal));
		calcularVenta();
		$('#cizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	});
}

function msimilares(url,id)
{
	$('#bussimilares').modal('show');
	$('#tbprincipio').html('');
	const datap = new FormData();
	datap.append('id',id);
	fetch(url,{
	   method: 'POST',
	   body: datap
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#tbprincipio').html('<tr><td colspan="6"><strong>No hay datos de la busqueda</strong></td></tr>');
		}
		else
		{
			var cadena='';
			$.each(datos, function(i,item){
				var nproducto=item.descripcion;
		    if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
			  if (item.stock<1 && item.tipo=='B') {
	    		colores= '#dc3545';
				} else {
					if (item.bonificacion>0) {colores= '#00c800';} else {colores= '#000000';}
				}
        if (item.vsujeta==1) {tcolor='table-success';} else {tcolor='';}
				cadena += '<tr style="color: '+colores+';" class="'+tcolor+'">';
				cadena +='<td>'+(item.puntos==1 ? 'PUN': '')+'</td>';
				cadena +='<td>'+nproducto+'</td>';
				cadena +='<td align="center">'+item.stock+'</td>';
				if (item.stock>0 || item.tipo=='S') {
					cadena +='<td align="right"><a href="javascript:void(0)" class="btn btn-info btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+'\`,\'NIU\',\'1\',\''+item.tafectacion+'\',\''+item.pventa+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.pventa+'</a></td>';
						cadena +='<td align="right">';
					if (item.factorb>1 && item.pblister>0 && parseInt(item.stock)>=item.factorb) {
					cadena +='<a href="javascript:void(0)" class="btn btn-primary btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+' BLISTER X '+item.factorb+'\`,\'BL\','+item.factorb+',\''+item.tafectacion+'\',\''+item.pblister+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.pblister+'</a>';
					}
					cadena +='</td>';
					cadena +='<td align="right">';
					if (item.factor>1 && item.venta>0 && parseInt(item.stock)>=item.factor) {
					cadena +='<a href="javascript:void(0)" class="btn btn-success btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+' CJ X '+item.factor+'\`,\'BX\','+item.factor+',\''+item.tafectacion+'\',\''+item.venta+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.venta+'</a>';
					}
					cadena +='</td>';
				} else {
					cadena +='<td align="right">'+item.pventa+'</td>';
					cadena +='<td align="right">'+(item.factorb>1 && item.pblister>0 ? item.pblister : '')+'</td>';
					cadena +='<td align="right">'+(item.factor>1 && item.venta>0 ? item.venta : '')+'</td>';
				}
			    cadena +='</tr>';
				$('#tbprincipio').html(cadena);
			});
		}
	})
	.catch(function(err) {
	   console.log(err);
	});

	$('#tbterapeutica').html('');
	let aurl=url.replace('busPrincipio','busTerapeutico');
	const datat = new FormData();
	datat.append('id',id);
	fetch(aurl,{
	   method: 'POST',
	   body: datat
	})
	.then(function(response) {
	   if(response.ok) {
	       return response.json();
	   } else {
	       throw "Error en la llamada Ajax";
	   }
	})
	.then((datos) => {
		//console.log(datos);
		if (datos.length==0)
		{
			$('#tbterapeutica').html('<tr><td colspan="6"><strong>No hay datos de la busqueda</strong></td></tr>');
		}
		else
		{
			var cadena='';
			$.each(datos, function(i,item){
		    var nproducto=item.descripcion;
	      if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
		    if (item.stock<1 && item.tipo=='B') {
	    		colores= '#dc3545';
				} else {
					if (item.bonificacion>0) {colores= '#00c800';} else {colores= '#000000';}
				}
        if (item.vsujeta==1) {tcolor='table-success';} else {tcolor='';}
				cadena += '<tr style="color: '+colores+';" class="'+tcolor+'">';
				cadena +='<td>'+(item.puntos==1 ? 'PUN': '')+'</td>';
				cadena +='<td>'+nproducto+'</td>';
				cadena +='<td align="center">'+item.stock+'</td>';
				if (item.stock>0 || item.tipo=='S') {
					cadena +='<td align="right"><a href="javascript:void(0)" class="btn btn-info btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+'\`,\'NIU\',\'1\',\''+item.tafectacion+'\',\''+item.pventa+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.pventa+'</a></td>';
						cadena +='<td align="right">';
					if (item.factorb>1 && item.pblister>0 && parseInt(item.stock)>=item.factorb) {
					cadena +='<a href="javascript:void(0)" class="btn btn-primary btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+' BLISTER X '+item.factorb+'\`,\'BL\','+item.factorb+',\''+item.tafectacion+'\',\''+item.pblister+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.pblister+'</a>';
					}
					cadena +='</td>';
					cadena +='<td align="right">';
					if (item.factor>1 && item.venta>0 && parseInt(item.stock)>=item.factor) {
					cadena +='<a href="javascript:void(0)" class="btn btn-success btn-sm py-0" onclick="appventa(\''+item.id+'\', \`'+nproducto+' CJ X '+item.factor+'\`,\'BX\','+item.factor+',\''+item.tafectacion+'\',\''+item.venta+'\',\''+item.lote+'\',\''+item.stock+'\',\''+item.tipo+'\',\''+item.descuento+'\',\''+item.edicion+'\',\''+item.vsujeta+'\');">'+item.venta+'</a>';
					}
					cadena +='</td>';
				} else {
					cadena +='<td align="right">'+item.pventa+'</td>';
					cadena +='<td align="right">'+(item.factorb>1 && item.pblister>0 ? item.pblister : '')+'</td>';
					cadena +='<td align="right">'+(item.factor>1 && item.venta>0 ? item.venta : '')+'</td>';
				}
			    cadena +='</tr>';
				$('#tbterapeutica').html(cadena);
			});
		}
	})
	.catch(function(err) {
	   console.log(err);
	});

	$('#tbinformacion').html('');
	let iurl=url.replace('busPrincipio','busInformacion');
	$.post(iurl,{id},function(resp){
		$("#tbinformacion").html(resp);
	});

	$('#tbestablecimiento').html('');
	let eurl=url.replace('busPrincipio','busEstablecimiento');
	$.post(eurl,{id},function(resp){
		$("#tbestablecimiento").html(resp);
	});
}

function productoBarrav(event,url,id)
{
	if(event.which === 13){
		event.preventDefault();
		if (id!='') {
			$.post(url,{id},function(responder){
				if (responder=='null') {
					toastr.error('El codigo de barra no existe');
				} else {
					var item=JSON.parse(responder);
					id=item.id;
					verificar=cantidadProducto('producton');
					if (verificar.includes(id)) {
				    nro = verificar.indexOf(id);
				    nlote=document.getElementsByClassName('loten')[nro].value;
				    if (nlote!='') {
				    	toastr.info('Ya se registro este producto', '',{"positionClass" : "toast-top-center"});
				    } else {
					    factori=document.getElementsByClassName('factorn')[nro].value;
					    if (1!=factori) {
					    	toastr.info('No es la misma presentacion del producto debe cambiarla', '',{"positionClass" : "toast-top-center"});
					    } else {
						    cantidad=parseFloat(document.getElementsByClassName('cantidadn')[nro].value)+1;
						    document.getElementsByClassName('cantidadn')[nro].value = cantidad;

						    tipo = document.getElementsByClassName('tipon')[nro].value;
							  factor=document.getElementsByClassName('factorn')[nro].value;
								precio=document.getElementsByClassName('precion')[nro].value;
								almacenc=cantidad*factor;
								importe = cantidad*precio;
								descuento = document.getElementsByClassName('dscton')[nro].value==0 ? importe*document.getElementsByClassName('porcentajen')[nro].value/100 : document.getElementsByClassName('porcentajen')[nro].value;
								mtotal =importe-descuento;
								document.getElementsByClassName('calmacenn')[nro].value = almacenc;
								document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
								stock = document.getElementsByClassName('stockn')[nro].value;

								if (almacenc>stock && tipo=='B') {
									toastr.error('Stock es mucho menor', '',{"positionClass" : "toast-top-center"});
									document.getElementsByClassName('cantidadn')[nro].value = 1;
									almacenc=1*factor;
									importe = 1*precio;
									mtotal =importe-descuento;
									document.getElementsByClassName('calmacenn')[nro].value = almacenc;
									document.getElementsByClassName('importen')[nro].value = decimales(mtotal);
								}
								calcularVenta();
						  }
						}
				  }else{
						if (item.vsujeta==1) {toastr.info('Este producto necesita receta', '',{"positionClass" : "toast-top-center"});}
						var nproducto=item.descripcion;
			      if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
						if (item.stock>0) {
							let almacenc=1;
							let mtotal=decimales(item.pventa*1);
							let dscto=item.dscto;
							let escondido=dscto==2 ? 'hidden' : 'number';
							let descuento=dscto==0 ? '%' : 'S/.';
							let estilo=item.edicion==0 ? 'campo' : 'form-control form-control-sm';
							let bloquear=item.edicion==0 ? 'onkeydown="return false"' : '';
							cadena = '<tr>';
							cadena += '<td colspan="2"><input type="text" name="descripcion[]" value="'+nproducto+'" class="campo" readonly /><input type="hidden" name="idproducto[]" value="'+item.id+'" class="producton"/><input type="hidden" name="tipo[]" id="tipo[]" value="'+item.tipo+'" class="tipon">';
							cadena += '<div class="row"><div class="col-sm-3 col-4"><input type="text" name="nlote[]" value="" class="campo loten"/><input type="hidden" name="lote[]" value="'+item.lote+'" class="campo"/></div>';
							cadena += '<div class="col-sm-1 col-4"><input type="hidden" class="calmacenn" name="almacenc[]" value="'+almacenc+'"/><input type="hidden" class="factorn" name="factor[]" id="factor[]" value="1"><input type="text" name="unidad[]" value="NIU" class="campo"/><input type="hidden" name="tafectacion[]" value="'+item.tafectacion+'" class="campo"/></div>';
							cadena += '<div class="col-sm-2 col-4"><input type="hidden" name="stock[]" value="'+item.stock+'" class="stockn"/><input type="number" name="cantidad[]" value="1" min="1" class="form-control form-control-sm cantidadn" onkeypress="return event.keyCode != 13;"/></div>';
							cadena += '<div class="col-sm-2 col-4"><input type="text" name="precio[]" value="'+item.pventa+'" class="'+estilo+' text-right precion" '+bloquear+'/></div>';
							cadena += '<div class="col-sm-2 col-4"><input type="hidden" class="dscton" name="tdscto[]" id="tdscto[]" value="'+dscto+'"><input type="'+escondido+'" step="0.01" name="dscto[]" value="" class="form-control form-control-sm border border-danger porcentajen" placeholder="('+descuento+')Dscto"/></div>';
							cadena += '<div class="col-sm-2 col-4"><input  type="number" min="0.01" step="0.01" name="importe[]" value="'+mtotal+'" class="campo text-right importen"/></div></div></td>';
							cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
							cadena += "</tr>";
							$("#grilla").prepend(cadena);
							fveliminar();
							calcularv();
							calcularVenta();
						}else{
							toastr.error('El producto no tiene stock para la venta');
						}
					}
				}
			});
		} else {
			let durl=url.replace('busCodigobarra','busProductos');
			productoNombrev(durl,id);
		}
		$('#bproducto').val('');
		$('#codbarra').val('');
		$('#codbarra').focus();
	}
}

function fveliminar()
{
	$("a.elimina").click(function(){
		$(this).parents("tr").fadeOut("normal", function(){
			$(this).remove();
			calcularVenta();
			$('#cizipay').val('');
			$('#mizipay').val('');
			$('#pagar').val('');
			toastr.error('El producto fue eliminado');
		})
	});
};

function limpiarBuscadorv(url)
{
	$('#bproducto').val('');
	productoNombrev(url,'a');
}

function pagoCredito(valor)
{
    if (valor.checked) {
        document.getElementById('contado').style.display='none';
        var contador = document.getElementsByName("metodos").length;
        for(i=0;i<contador;i++){
        	let j=i+1
        	$('#metodo'+j+'').remove();
    	}

        document.getElementById('credito').style.display='block';
        $("#fvencimiento").prop('required',true);
        $("#pcuota").prop('required',true);
        $("#cuotas").prop('required',true);
        $("#mcuota").prop('required',true);
    }
    else {
    	document.getElementById('contado').style.display='block';

        document.getElementById('credito').style.display='none';
        $("#fvencimiento").removeAttr('required',true);
        $("#pcuota").removeAttr('required',true);
        $("#cuotas").removeAttr('required',true);
        $("#mcuota").removeAttr('required',true);
        $("#fvencimiento").val('');
        $("#pcuota").val('');
        $("#cuotas").val('');
        $("#mcuota").val('');
    }
}

function pagoIzipay(valor)
{
	if (valor.checked) {
		document.getElementById('cizipay').style.display='block';
		$('#pizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	}
	else {
		document.getElementById('cizipay').style.display='none';
		$('#pizipay').val('');
		$('#mizipay').val('');
		$('#pagar').val('');
	}
}

function calcularDistribucionPagos() {
    var total = parseFloat(document.getElementById('totalg').value) || 0;
    var metodosPago = document.getElementsByName('mpago[]');
    var montos = document.getElementsByName('monto[]');
    
    if (metodosPago.length === 0 || total === 0) {
        return;
    }
    
    // Si solo hay un método de pago, asignar todo el total
    if (metodosPago.length === 1) {
        montos[0].value = total.toFixed(2);
        return;
    }
    
    // Distribuir equitativamente entre todos los métodos
    var montoPorMetodo = Math.floor((total / metodosPago.length) * 100) / 100; // Redondear hacia abajo
    var montoRestante = total;
    
    for (var i = 0; i < montos.length; i++) {
        if (i === montos.length - 1) {
            // El último método recibe el resto para que la suma sea exacta
            montos[i].value = montoRestante.toFixed(2);
        } else {
            montos[i].value = montoPorMetodo.toFixed(2);
            montoRestante -= montoPorMetodo;
        }
    }
}

function distribucionInteligente() {
    var total = parseFloat(document.getElementById('totalg').value) || 0;
    var metodosPago = document.getElementsByName('mpago[]');
    var montos = document.getElementsByName('monto[]');
    
    if (metodosPago.length === 0 || total === 0) {
        return;
    }
    
    // Distribución inteligente basada en el tipo de método de pago
    var distribucion = {};
    var totalDistribuido = 0;
    
    for (var i = 0; i < metodosPago.length; i++) {
        var metodoSeleccionado = metodosPago[i].options[metodosPago[i].selectedIndex].text.toLowerCase();
        var porcentaje = 0;
        
        // Asignar porcentajes según el tipo de método
        if (metodoSeleccionado.includes('efectivo')) {
            porcentaje = 0.3; // 30% para efectivo
        } else if (metodoSeleccionado.includes('tarjeta')) {
            porcentaje = 0.4; // 40% para tarjetas
        } else if (metodoSeleccionado.includes('yape') || metodoSeleccionado.includes('plin')) {
            porcentaje = 0.2; // 20% para billeteras digitales
        } else {
            porcentaje = 0.1; // 10% para otros métodos
        }
        
        distribucion[i] = total * porcentaje;
        totalDistribuido += distribucion[i];
    }
    
    // Ajustar para que la suma sea exacta
    var diferencia = total - totalDistribuido;
    if (diferencia !== 0) {
        distribucion[0] += diferencia; // Ajustar en el primer método
    }
    
    // Asignar los montos calculados
    for (var i = 0; i < montos.length; i++) {
        montos[i].value = distribucion[i].toFixed(2);
    }
}

function apppagos(url)
{
	document.getElementsByName("monto[]")[0].removeAttribute("readonly");
	
	var contador = document.getElementsByName("mpago[]").length;
	cadena = '<div class="form-group row mb-2" id="metodo'+contador+'" name="metodos">';
  cadena += '<label for="mpago" class="col-sm-2 col-6 col-form-label">Medio Pago*</label>';
  cadena += '<div class="col-sm-3 col-6">';
  cadena += '<select name="mpago[]" id="mpago[]" class="form-control form-control-sm metodo">';
  cadena += '</select>';
  cadena += '</div>';
  cadena += '<label for="monto" class="col-sm-2 col-6 col-form-label">Monto</label>';
  cadena += '<div class="col-sm-2 col-4">';
  cadena += '<input name="monto[]" type="text" id="monto[]" class="form-control form-control-sm" value=""/>';
  cadena += '</div>';
  cadena += '<div class="col-sm-1 col-2">';
  cadena += '<button type="button" class="btn btn-danger btn-sm" onclick="borrarp(\'metodo'+contador+'\');"><i class="fa fa-trash"></i></button>';
  cadena += '</div>';
  cadena += '</div>';
	$("#contado").append(cadena);
	
	// Cargar opciones solo en el nuevo dropdown
	$.post(url,function(data){
		var c = JSON.parse(data);
		var nuevoSelect = $('#metodo'+contador+' select');
		$.each(c, function(i,item){
			nuevoSelect.append('<option value="'+item.id+'">'+item.descripcion+'</option>');
		});
	});
	
	// Redistribuir automáticamente después de agregar
	setTimeout(function() {
		calcularDistribucionPagos();
	}, 100);
}

function borrarp(id)
{
	$('#'+id+'').remove();
	contador=document.getElementsByName("monto[]").length;
	if (contador==1) {
		document.getElementsByName("monto[]")[0].setAttribute("readonly", "readonly");
		document.getElementById('monto[]').value=$('#totalg').val();
	} else {
		// Redistribuir automáticamente después de eliminar
		setTimeout(function() {
			calcularDistribucionPagos();
		}, 100);
	}
}

function envioVenta(url)
{
	event.preventDefault();

	Swal.fire({
		title: "<span style='color:#3085d6;font-weight:bold;font-size:1.1rem;'>¿Desea generar la venta?</span>",
		html: "<span style='color:#555;'>Esta acción <b>no podrá revertirse</b>.<br>¿Está seguro de continuar?</span>",
		icon: "success",
		showCancelButton: true,
		confirmButtonText: "<i class='fa fa-check'></i> Sí, guardar",
		cancelButtonText: "<i class='fa fa-times'></i> Cancelar",
		confirmButtonColor: '#6E62DF',
		cancelButtonColor: '#F33B53',
		background: '#f8f9fa',
		customClass: {
			popup: 'swal2-border-radius swal2-popup-sm',
			confirmButton: 'btn btn-success mx-2 btn-sm',
			cancelButton: 'btn btn-danger mx-2 btn-sm',
		},
		width: '350px',
		// height eliminado para reducir la altura del modal
	})
	.then((result) => {
		if (result.value) {
			document.getElementById("btsubmit").value = "Enviando...";
			document.getElementById("btsubmit").disabled = true;

			$.ajax({
				url: url,
				type: 'POST',
				async:true,
				data: $('#form1').serialize(),
				success: function(responder) {
					console.log(responder);
					var dato = JSON.parse(responder);
					if (dato.impresion!='') {
						window.open(dato.impresion,'_blank');
						window.location.href=dato.url;
						toastr.success(dato.mensaje);
					} else {
						toastr.error(dato.mensaje);
						setTimeout(function () {
							document.getElementById("btsubmit").value = "Guardar";
							document.getElementById("btsubmit").disabled = false;
						}, 800);
					}
				},
				error: function(error) {
					console.log(error);
				}
			});
		}
	})
}

/*==========================================================================================================================
=                                              venta en lotes                                                              =
==========================================================================================================================*/
$('#busventa').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#busventa').on('hidden.bs.modal', function (e){
	reset_vental();
})

function mvental(id,nom,pre,fac,und,afec,lote,cant,tipo,url)
{
	$('#busventa').modal('show');
	$("#munidades").removeClass("is-invalid");
	$("#mcosto").removeClass("is-invalid");
	$("#mlote").removeClass("is-invalid");

	document.getElementById('mcodigo').value = id;
	document.getElementById('mdescripcion').value = nom;
	document.getElementById('mstock').value = cant;
	document.getElementById('mafectacion').value = afec;
	document.getElementById('mfactor').value = 1;
	document.getElementById('mcosto').value = und;
	document.getElementById('mactivar').value = lote;
	document.getElementById('mtipo').value = tipo;

	document.getElementById('munidades').value = 1;
	document.getElementById('mtotal').value = decimales(1*und);
	document.getElementById('mcantidad').value = 1;
	document.getElementById('munidades').select();
	if (lote==1) {
		$('#tbLotes').html('');
		document.getElementById('mdetalle').style.display = 'block';
		var cadena='';
		$.post(url,{id},function(data){
			var c = JSON.parse(data);
			$.each(c, function(i,item){
				var valores=item.nlote+'|'+item.stock;
				cadena += '<tr>';
				cadena += '<td><div class="form-check"><label class="form-check-label"><input class="form-check-input nlote" type="checkbox" value="'+valores+'" onclick="marcados(this)">'+item.nlote+'</label><div></td>';
				cadena += '<td>'+item.stock+'</td>';
				cadena += '<td>'+item.fvencimiento+'</td>';
				cadena += "</tr>";
				$('#tbLotes').html(cadena);
			});
		});
	}else{
		document.getElementById('mdetalle').style.display = 'none';
	}

	$('#mmedida').html('');
	if (fac>1) {
		$("#mmedida").append('<option value="NIU|1|'+und+'">Unidad</option>');
		$("#mmedida").append('<option value="BX|'+fac+'|'+pre+'">Caja</option>');
	}else{
		$("#mmedida").append('<option value="NIU|1|'+und+'">Unidad</option>');
	}
	document.getElementById('munidades').select();
}

function appvental()
{
	var id=$('#mcodigo').val();
	var producto=$('#mdescripcion').val();
	var medida=$('#mmedida').val().split('|');
	var afectacion=$('#mafectacion').val();
	var cantidad=$('#munidades').val();
	var precio=$('#mcosto').val();
	var total=$('#mtotal').val();
	var lote=$('#clote').val();
	var stock=parseFloat($('#mstock').val());
	var restringir=$('#mactivar').val();
	var factor=$('#mfactor').val();
	var almacenc=$('#mcantidad').val();
	var centregar=parseFloat($('#centregar').val());
	var tipo=$('#mtipo').val();
	var dscto=$('#mdscto').val();
	var escondido=dscto==2 ? 'hidden' : 'number';
	var descuento=$('#mdscto').val()==0 ? '%' : 'S/.';
	var edicion=$('#medicion').val();
	var estilo=$('#medicion').val()==0 ? 'campo' : 'form-control form-control-sm';
	var bloquear=edicion==0 ? 'onkeydown="return false"' : '';

	verificar=cantidadProducto('producton');
	if (verificar>1) {
		toastr.info('Ya se agrego este producto a la venta', '',{"positionClass" : "toast-top-center"});
	} else {
		if (restringir==1) {
			if(id!='' && producto!='' && cantidad!='' && precio!='' && lote!='' && almacenc<=stock && centregar>=almacenc){
				cadena = '<tr>';
				cadena += '<td colspan="2"><input type="text" name="descripcion[]" value="'+producto+'" class="campo" readonly /><input type="hidden" name="idproducto[]" value="'+id+'" class="producton"/><input type="hidden" name="tipo[]" id="tipo[]" value="'+tipo+'">';
				cadena += '<div class="row"><div class="col-sm-3 col-4"><input type="text" name="nlote[]" value="'+lote+'" class="campo loten"/><input type="hidden" name="lote[]" value="'+restringir+'" class="campo"/></div>';
				cadena += '<div class="col-sm-1 col-4"><input type="hidden" class="factorn" name="factor[]" id="factor[]" value="'+factor+'"><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/><input type="hidden" name="tafectacion[]" value="'+afectacion+'" class="campo"/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="hidden" name="stock[]" value="'+stock+'" class="stockn"/><input type="number" name="cantidad[]" value="'+cantidad+'" min="1" class="campo cantidadn" onkeypress="return event.keyCode != 13;"/><input type="hidden" class="calmacenn" name="almacenc[]" value="'+almacenc+'"/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="text" name="precio[]" value="'+precio+'" class="'+estilo+' text-right precion" '+bloquear+'/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="hidden" class="dscton" name="tdscto[]" id="tdscto[]" value="'+dscto+'"><input type="'+escondido+'" step="0.01" name="dscto[]" value="" class="form-control form-control-sm border border-danger porcentajen" placeholder="('+descuento+')Dscto"/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="number" min="0.01" step="0.01" name="importe[]" value="'+decimales(total)+'" class="campo text-right importen"/></div></div></td>';
				cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
				cadena += "</tr>";
				$("#grilla").prepend(cadena);
	    		$('#busventa').modal('hide');
			}else{
				$('#mensajeerror').html('<strong class="text-danger">Falta ingresar datos del producto</strong>');
				if (cantidad=='') {document.getElementById("munidades").className += " is-invalid";}
				if (precio=='') {document.getElementById("mcosto").className += " is-invalid";}
				if (lote=='') {$('#mensajeerror').append('<strong class="text-danger"><br>Seleccione un lote</strong>');}
				if (almacenc>stock) {$('#mensajeerror').append('<strong class="text-danger"><br>EL stock actual en mucho menor al que desea vender</strong>');}
				if (centregar<almacenc) {$('#mensajeerror').append('<strong class="text-danger"><br>La cantidad de lote seleccionada es mucho menor</strong>');}
			}
		}else{
			if(id!='' && producto!='' && cantidad!='' && precio!='' && almacenc<=stock){
				cadena = '<tr>';
				cadena += '<td colspan="2"><input type="text" name="descripcion[]" value="'+producto+'" class="campo" readonly /><input type="hidden" name="idproducto[]" value="'+id+'" class="producton"/><input type="hidden" name="tipo[]" id="tipo[]" value="'+tipo+'">';
				cadena += '<div class="row"><div class="col-sm-3 col-4"><input type="text" name="nlote[]" value="'+lote+'" class="campo loten"/><input type="hidden" name="lote[]" value="'+restringir+'" class="campo"/></div>';
				cadena += '<div class="col-sm-1 col-4"><input type="hidden" class="factorn" name="factor[]" id="factor[]" value="'+factor+'"><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/><input type="hidden" name="tafectacion[]" value="'+afectacion+'" class="campo"/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="hidden" name="stock[]" value="'+stock+'" class="stockn"/><input type="number" name="cantidad[]" value="'+cantidad+'" min="1" class="campo cantidadn" onkeypress="return event.keyCode != 13;"/><input type="hidden" class="calmacenn" name="almacenc[]" value="'+almacenc+'"/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="text" name="precio[]" value="'+precio+'" class="'+estilo+' text-right precion" '+bloquear+'/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="hidden" class="dscton" name="tdscto[]" id="tdscto[]" value="'+dscto+'"><input type="'+escondido+'" step="0.01" name="dscto[]" value="" class="form-control form-control-sm border border-danger porcentajen" placeholder="('+descuento+')Dscto"/></div>';
				cadena += '<div class="col-sm-2 col-4"><input type="number" min="0.01" step="0.01" name="importe[]" value="'+decimales(total)+'" class="campo text-right importen"/></div></div></td>';
				cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
				cadena += "</tr>";
				$("#grilla").prepend(cadena);
	    		$('#busventa').modal('hide');
			}else{
				if (almacenc>stock) {$('#mensajeerror').html('<strong class="text-danger">EL stock actual en mucho menor al que desea vender</strong>');}
			}
		}
		fveliminar();
		calcularv();
		calcularVenta();
	}
};

function reset_vental()
{
	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#mfactor').val(1);
	$('#mstock').val('');
	$('#munidades').val('');
	$('#mcosto').val('');
	$('#mtotal').val('');
	$('#mcantidad').val('');

	$('#centregar').val(0);
	$('#clote').val('');
	$('#tbLotes').html('');
	document.getElementById('mdetalle').style.display = 'none';
}

/*=======================================================================================================================
=                                                    funciones despacho                                                 =
=======================================================================================================================*/
function traslado(valor)
{
    if (valor=='01') {
        document.getElementById('tpublico').style.display='block';
        document.getElementById('tprivado').style.display='none';

        document.getElementById('documentot').value = 6;
        document.getElementById('ndocumentot').value = '';
        document.getElementById('nombrest').value = '';

        document.getElementById('documentoc').value = 0;
        document.getElementById('ndocumentoc').value = '-';
        document.getElementById('nombresc').value = '-';
        document.getElementById('placa').value = '-';
        document.getElementById('licencia').value = '-';
    }
    else {
        document.getElementById('tpublico').style.display='none';
        document.getElementById('tprivado').style.display='block';

        document.getElementById('documentot').value = 0;
        document.getElementById('ndocumentot').value = '-';
        document.getElementById('nombrest').value = '-';

        document.getElementById('documentoc').value = 1;
        document.getElementById('ndocumentoc').value = '';
        document.getElementById('nombresc').value = '';
        document.getElementById('placa').value = '';
        document.getElementById('licencia').value = '';
    }
}

function destinatarioNombre(url,id)
{
	document.getElementById('tblcliente').style.display = 'block';
	$('#grcliente').html('');
	if (id.length>2) {
		$.ajax({
			url: url,
			type: 'POST',
			async:true,
			data: { id : id },
			success: function(responder) {
				var datos=JSON.parse(responder);
				if (datos.length==0)
				{
					$('#grcliente').html('<strong>No hay datos de la busqueda</strong>');
				}
				else
				{
					var cadena='';
					$.each(datos, function(i,item){
			        	var ant=i-1;
						var pos=i+1;
						var anterior='input'+ant;
						var posterior='input'+pos;
					    cadena +='<a href="javascript:void(0)" onclick="datosDestinatario(\''+item.id+'\', \`'+item.nombres+'\`,\''+item.iddepartamento+'\',\''+item.idprovincia+'\',\''+item.iddistrito+'\',\''+item.direccion+'\',\''+url+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+item.documento+' - '+item.nombres+'</dt></a>';
					    cadena +='<hr class="m-0">';
			        	$('#grcliente').html(cadena);
					});
				}
			},

			error: function(error) {
				console.log(error);
			}
		});
	} else {
		$('#grcliente').html('');
		document.getElementById('tblcliente').style.display = 'none';
	}
}

function datosDestinatario(cod,nom,dep,pro,dis,dir,url)
{
	document.getElementById('idcliente').value = cod;
	document.getElementById('cliente').value = nom;
	let purl=url.replace('cliente/busCliente','establecimiento/busProvincia');
	let durl=url.replace('cliente/busCliente','establecimiento/busDistrito');
	document.getElementById('departamentoe').value = dep;
	bubicaciones(purl,dep,'provinciae',pro);
	bubicaciones(durl,pro,'distritoe',dis);
	document.getElementById('direccione').value = dir;

	$('#grcliente').html('');
	document.getElementById('tblcliente').style.display = 'none';
}

function datosPrivado(doc,num,nom,lic,pla)
{
	document.getElementById('documentoc').value = doc;
	document.getElementById('ndocumentoc').value = num;
	document.getElementById('nombresc').value = nom;
	document.getElementById('licencia').value = lic;
	document.getElementById('placa').value = pla;
	$('#mdconductor').modal('hide');
}

function datosPublico(doc,num,nom)
{
	document.getElementById('documentot').value = doc;
	document.getElementById('ndocumentot').value = num;
	document.getElementById('nombrest').value = nom;
	$('#mdtransportista').modal('hide');
}

$('#busdespacho').on('shown.bs.modal', function () {
    $('#mdescripcion').focus();
})

$('#busdespacho').on('hidden.bs.modal', function (e){
	reset_despacho();
})

function productoNombred(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblProducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

        	var nproducto=item.descripcion;
        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
        	cadena +='<a href="javascript:void(0)" onclick="mdespacho(\''+item.id+'\', \`'+nproducto+'\`,\''+item.factor+'\',\''+item.lote+'\',\''+url+'\');" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+'</dt></a>';
        	$('#grproducto').html(cadena);
				});
			}
	  })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function mdespacho(id,nom,fac,lote,url)
{
	reset_despacho();
	document.getElementById('mcodigo').value = id;
	document.getElementById('mdescripcion').value = nom;

	if (lote==1) {
		$('#tbLotes').html('');
		document.getElementById('mdetalle').style.display = 'block';

		var lurl=url.replace('busProductos','busLotes');
		var cadena='';
		$.post(lurl,{id},function(data){
			var c = JSON.parse(data);
			$.each(c, function(i,item){
				var valores=item.nlote+'|'+item.stock+'|'+item.fvencimiento;
				cadena += '<tr>';
				cadena += '<td><div class="form-check"><label class="form-check-label"><input class="form-check-input nlote" type="checkbox" value="'+valores+'" onclick="marcadosd(this)">'+item.nlote+'</label><div></td>';
				cadena += '<td>'+item.stock+'</td>';
				cadena += '<td>'+item.fvencimiento+'</td>';
				cadena += "</tr>";
				$('#tbLotes').html(cadena);
			});
		});
	}else{
		document.getElementById('mdetalle').style.display = 'none';
	}

	$('#mmedida').html('');
	if (fac>1) {
		$("#mmedida").append('<option value="NIU|1">Unidad</option>');
		$("#mmedida").append('<option value="BX|'+fac+'">Caja</option>');
	}else{
		$("#mmedida").append('<option value="NIU|1">Unidad</option>');
	}

	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
	document.getElementById('mcantidad').select();
}

function marcadosd(nvalor)
{
	let numerosl = [];
	let cantidades=0;
	let vencimientol = [];
	let cpedido=parseFloat($('#mcantidad').val());
	let cactual=parseFloat($('#centregar').val());

	if (nvalor.checked) {
		if (cpedido>=cactual) {
			$(".nlote:checked").each(function(){
				var valor=this.value.split('|');
				numerosl.push(valor[0]);
				cantidades+=parseFloat(valor[1]);
				vencimientol.push(valor[2]);
			});

			document.getElementById('nlote').value=numerosl;
			document.getElementById('centregar').value=cantidades;
			document.getElementById('flote').value=vencimientol;
		}
		else {
			nvalor.checked=0;
		}
	}else{
		$(".nlote:checked").each(function(){
			var valor=this.value.split('|');
			numerosl.push(valor[0]);
			cantidades+=parseFloat(valor[1]);
			vencimientol.push(valor[2]);
		});

		document.getElementById('nlote').value=numerosl;
		document.getElementById('centregar').value=cantidades;
		document.getElementById('flote').value=vencimientol;
	}
}

function appdespacho()
{
	var codigo=$('#mcodigo').val();
	var nombres=$('#mdescripcion').val();
	var cantidad=$('#mcantidad').val();
	var medida=$('#mmedida').val().split('|');
	var nlote=$('#nlote').val();
	var flote=$('#flote').val();

	if(codigo!='' && nombres!='' && cantidad!=''){
		cadena = '<tr>';
		cadena += '<td><input type="hidden" name="idproducto[]" value="'+codigo+'"/><input type="text" name="descripcion[]" value="'+nombres+'" class="campo"/></td>';
		cadena += '<td><input type="hidden" name="factor[]" value="'+medida[1]+'"/><input type="text" name="unidad[]" value="'+medida[0]+'" class="campo"/></td>';
		cadena += '<td><input type="text" name="cantidad[]" value="'+cantidad+'" min="1" class="campo"/></td>';
		cadena += '<td><input type="text" name="lote[]" value="'+nlote+'" class="campo"/></td>';
		cadena += '<td><input type="text" name="fvencimiento[]" value="'+flote+'" class="campo"/></td>';
		cadena += '<td><a href="javascript:void(0)" class="btn btn-danger btn-sm py-0 elimina" title="Eliminar" data-toggle="tooltip" data-placement="bottom"><i class="fa fa-trash"></i></a></td>';
		cadena += "</tr>";
		$("#grilla").prepend(cadena);
		reset_despacho();
		feliminar();
		$('#busdespacho').modal('hide');
	}
};

function reset_despacho()
{
	$('#mensajeerror').html('');
	$('#mcodigo').val('');
	$('#mdescripcion').val('');
	$('#mcantidad').val('');
	$('#mmedida').val('');

	$('#centregar').val(0);
	$('#nlote').val('');
	$('#flote').val('');
	$('#tbLotes').html('');
	document.getElementById('mdetalle').style.display = 'none';

	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
}

/*=========================================================================================================================
=                                                    funciones reporte                                                    =
=========================================================================================================================*/
function productoNombre(url,id)
{
	$('#mensajeerror').html('');
	document.getElementById('tblProducto').style.display = 'block';
	$('#grproducto').html('');
	if (id.length > 2) {
		const data = new FormData();
		data.append('id', id);

		fetch(url, {
		   method: 'POST',
		   body: data
		})
		.then(function(response) {
		   if(response.ok) {
		       return response.json();
		   } else {
		       throw "Error en la llamada Ajax";
		   }
		})
		.then((datos) => {
			//console.log(datos);
			if (datos.length==0)
			{
				$('#grproducto').html('<strong>No hay datos de la busqueda</strong>');
			}
			else
			{
				var cadena='';
				$.each(datos, function(i,item){
		        	var ant=i-1;
					var pos=i+1;
					var anterior='input'+ant;
					var posterior='input'+pos;

		        	var nproducto=item.descripcion;
		        	if (item.nlaboratorio!='') {nproducto+=' ['+item.nlaboratorio+']';}
				    cadena +='<a href="javascript:void(0)" onclick="pproducto(\''+item.id+'\', \`'+nproducto+'\`);" title="Click para seleccionar" id="input'+i+'" onkeyup="saltar(event,\''+anterior+'\',\''+posterior+'\')"><dt class="mx-2">'+nproducto+'</dt></a>';
				    cadena +='<hr class="m-0">';
		        	$('#grproducto').html(cadena);
				});
			}
	    })
		.catch(function(err) {
		   console.log(err);
		});
	}
}

function pproducto(cod,nom)
{
	document.getElementById('idproducto').value = cod;
	document.getElementById('descripcion').value = nom;
	$('#grproducto').html('');
	document.getElementById('tblProducto').style.display = 'none';
}

function atributos(url,id)
{
	$('#nombres').html('');
	$.post(url,{id},function(data){
		var c = JSON.parse(data);
		$.each(c, function(i,item){
			$('#nombres').append('<option value="'+item.id+'">'+item.descripcion+'</option>');
		});
	});
}

/*====================================================================================================================
=                                                  funciones validador                                               =
====================================================================================================================*/
function vcomprobante(nro,url)
{
	$('#serie').html('');
	$.post(url,{nro},function(data){
		var c = JSON.parse(data);
		$.each(c, function(i,item){
			$('#serie').append('<option value="'+item.serie+'">'+item.serie+'</option>');
		});
	});
}

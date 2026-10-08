// Configuración común para todos los gráficos
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        boxWidth: 12,
        padding: 20,
        font: {
          family: "'Segoe UI', Roboto, sans-serif",
          size: 12
        }
      }
    },
    title: {
      display: true,
      font: {
        family: "'Segoe UI', Roboto, sans-serif",
        size: 16,
        weight: '600'
      },
      padding: {
        top: 10,
        bottom: 20
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0,0,0,0.8)',
      titleFont: {
        size: 14,
        weight: 'bold'
      },
      bodyFont: {
        size: 12
      },
      padding: 12,
      cornerRadius: 8
    }
  },
  scales: {
    x: {
      grid: {
        display: false,
        drawBorder: false
      },
      ticks: {
        font: {
          family: "'Segoe UI', Roboto, sans-serif"
        }
      }
    },
    y: {
      grid: {
        color: 'rgba(0,0,0,0.05)',
        drawBorder: false
      },
      ticks: {
        font: {
          family: "'Segoe UI', Roboto, sans-serif"
        }
      }
    }
  },
  elements: {
    bar: {
      borderRadius: 6,
      borderSkipped: false
    }
  }
};

// Función vhorario modernizada
function vhorario() {
  var inicio = $("#inicio").val();
  var fin = $("#fin").val();

  var horas = [];
  var ventas = [];
  
  $.post('ventash', {inicio, fin}, function(data) {
    var c = JSON.parse(data);
    $.each(c, function(i, item) {
      horas.push(item.horas);
      ventas.push(item.ventas);
    });

    var barChartData = {
      labels: horas,
      datasets: [{
        label: 'Ventas Realizadas',
        backgroundColor: 'rgba(74, 108, 247, 0.8)',
        borderColor: 'rgba(74, 108, 247, 1)',
        borderWidth: 0,
        hoverBackgroundColor: 'rgba(74, 108, 247, 1)',
        data: ventas
      }]
    };

    var barChartCanvas = $('#barChart').get(0).getContext('2d');
    var barChartOptions = {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: {
          ...chartDefaults.plugins.title,
          text: 'Ventas por Horarios'
        }
      }
    };

    new Chart(barChartCanvas, {
      type: 'bar',
      data: barChartData,
      options: barChartOptions
    });
  });
}

// Función vmensual modernizada
function vmensual() {
  var fechas = [];
  var ventas = [];
  var nventas = [];
  
  $.post('inicio/ventasm', function(data) {
    var c = JSON.parse(data);
    $.each(c, function(i, item) {
      fechas.push(item.fechas);
      ventas.push(item.ventas);
      nventas.push(item.nventas);
    });

    var barChartData = {
      labels: fechas,
      datasets: [
        {
          label: 'Total comprobantes',
          backgroundColor: '#6E62DF',
          borderColor: '#6E62DF',
          borderWidth: 0,
          hoverBackgroundColor: '#5A4FBF',
          data: ventas
        },
        {
          label: 'Total notas ventas',
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 0,
          hoverBackgroundColor: 'rgba(255, 99, 132, 1)',
          data: nventas
        }
      ]
    };

    var barChartCanvas = $('#barVenta').get(0).getContext('2d');
    var barChartOptions = {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: {
          ...chartDefaults.plugins.title,
          text: 'Ventas Emitidas'
        }
      }
    };

    new Chart(barChartCanvas, {
      type: 'bar',
      data: barChartData,
      options: barChartOptions
    });
  });
}

// Función canual modernizada
function canual() {
  var fechas = [];
  var compras = [];
  
  $.post('inicio/comprasa', function(data) {
    var c = JSON.parse(data);
    $.each(c, function(i, item) {
      fechas.push(item.fechas);
      compras.push(item.compras);
    });

    var barChartData = {
      labels: fechas,
      datasets: [{
        label: 'Total compras',
        backgroundColor: 'rgba(51, 192, 121, 0.8)',
        borderColor: 'rgba(51, 192, 121, 1)',
        borderWidth: 0,
        hoverBackgroundColor: 'rgba(51, 192, 121, 1)',
        data: compras
      }]
    };

    var barChartCanvas = $('#barCompra').get(0).getContext('2d');
    var barChartOptions = {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: {
          ...chartDefaults.plugins.title,
          text: 'Compras Emitidas'
        }
      }
    };

    new Chart(barChartCanvas, {
      type: 'bar',
      data: barChartData,
      options: barChartOptions
    });
  });
}

// Función nventa modernizada (Doughnut)
function nventa() {
  $.post('inicio/nventac', function(data) {
    var item = JSON.parse(data);

    var chartdata = {
      labels: ['Total Cobrado', 'Pendiente de cobro'],
      datasets: [{
        data: [item.contado, item.credito],
        backgroundColor: ['#4A6CF7', '#FF6384'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 2,
        hoverBackgroundColor: ['#3A5BD9', '#E55370'],
        hoverOffset: 8
      }]
    };

    var options = {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: {
          ...chartDefaults.plugins.title,
          text: 'Estado de Notas de Venta'
        }
      },
      cutout: '70%',
      animation: {
        animateScale: true,
        animateRotate: true
      }
    };

    new Chart($("#doughnutNventa"), {
      type: 'doughnut',
      data: chartdata,
      options: options
    });
  });
}

// Función comprobante modernizada (Doughnut)
function comprobante() {
  $.post('inicio/comprobantec', function(data) {
    var item = JSON.parse(data);

    var chartdata = {
      labels: ['Total Cobrado', 'Pendiente de cobro'],
      datasets: [{
        data: [item.contado, item.credito],
        backgroundColor: ['#6E62DF', '#FF6384'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 2,
        hoverBackgroundColor: ['#5A4FBF', '#E55370'],
        hoverOffset: 8
      }]
    };

    var options = {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: {
          ...chartDefaults.plugins.title,
          text: 'Estado de Comprobantes'
        }
      },
      cutout: '70%'
    };

    new Chart($("#doughnutComprobante"), {
      type: 'doughnut',
      data: chartdata,
      options: options
    });
  });
}

// Función compra modernizada (Doughnut)
function compra() {
  $.post('inicio/comprac', function(data) {
    var item = JSON.parse(data);

    var chartdata = {
      labels: ['Total Pagado', 'Pendiente de pago'],
      datasets: [{
        data: [item.contado, item.credito],
        backgroundColor: ['#33C079', '#FF6384'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 2,
        hoverBackgroundColor: ['#2AA761', '#E55370'],
        hoverOffset: 8
      }]
    };

    var options = {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        title: {
          ...chartDefaults.plugins.title,
          text: 'Estado de Compras'
        }
      },
      cutout: '70%'
    };

    new Chart($("#doughnutCompra"), {
      type: 'doughnut',
      data: chartdata,
      options: options
    });
  });
}
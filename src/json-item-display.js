/*
 * APEX JSON-Item-Display plugin
 * (c) Uwe Simon 2024
 * Apache License Version 2.0
*/

"use strict";

/*
 * use the format for list pList for formatting the data in pValue
 * the format contains one or more JSON-path enclosed by #
 * Example "#$.lastname#, #$.firstname#" returns "Simon, Uwe"
*/
function formatValue(p_display, pList, pValue){
  console.log('>>formatValue', p_display, pList, pValue);
 // p_display =convertJsonParameter(p_display);
 // pValue =convertJsonParameter(pValue);  
  console.log('format value', p_display, pList, pValue);
  p_display = p_display ||{};
  p_display.apex = p_display.apex ||{};
  p_display = p_display.apex.display;
  p_display = p_display||{};
  let l_format = p_display[pList]||'';
  let l_result = l_format;
  let l_fields = l_format.match(/#[^#]+#/g) || [];
  for(const l_field of l_fields){
      let l_jsonpath = l_field.replaceAll('#', '');
      let l_value = JSONPath.JSONPath({path: l_jsonpath, json: pValue}) || [];
      l_result = l_result.replaceAll(l_field, l_value[0]?l_value[0]:'-');
  }

  console.log('<<formatValue', l_result);
  return (l_result);
}
    /*
     * convert quoted JSON string like '\"id\": \"abc\u000adef\"' into object
     */
function convertJsonParameter(p_str){
  let l_obj = undefined;
  let l_str = "";
  console.log('>>convert', p_str);
  try{
        // exclose with " so 2 parses will unquote all quoted characters
    if( typeof p_str == 'string'){
      l_str = JSON.parse(p_str);
//      l_str = JSON.parse('"' + p_str + '"');
    } else {
      l_str = p_str;
    }
    if( typeof l_str == 'string'){
      if(l_str.length>0){
        l_obj = JSON.parse(l_str);
      } else {
        l_obj = null;
      }
    } else {
      l_obj=l_str;
    }
  } catch(e) {
    apex.debug.error('json-item-display: schema', e, p_str);
    l_obj = {};
  }
  console.log('<<convert', l_obj);
  return (l_obj);
} 
    /*
     * initialize the JSON-Item-Display plugin, call form inside PL/SQL when plugin is initialized
     */
function initJsonItemDisplay(pItenName, pOptions){
  console.info('>>initJsonItemDisplay', pItenName,  pOptions);
  // pOptions.schema is quotted
  pOptions.schema =convertJsonParameter(pOptions.schema||'{}');
  pOptions.schema.apex = pOptions.schema.apex ||{};
  console.log('pOptions', pOptions);
  let l_value = apex.item(pOptions.dataitem).getValue();
  l_value = JSON.parse(l_value);

  let l_html = apex.util.applyTemplate(`
<div class="t-Form-itemWrapper">
  <input type="hidden" name="#ID#" id="#ID#" value="">
  <input type="hidden" data-for="#ID#" value="">
  <span id="#ID#_DISPLAY" class="display_only apex-item-display-only" data-escape="true">
#VALUE#
  </span>
</div>
`,
                                                {
                                                    placeholders: {
                                                      "ID":    pItenName,
                                                      "VALUE": (formatValue(pOptions.schema, pOptions.list, l_value))
                                                   }
                                                });
  $('#' + pItenName + '_CONTAINER .t-Form-itemWrapper').html(l_html);

  apex.item.create(pItenName, {
    item_type: "json_item_display",
    displayValueFor:function(value) {
      console.log('DISPLAY:', value);
      return formatValue(pOptions.schema, pOptions.list, '"' + (value ||'{}') + '"');
    }
  });
  console.log('<<initJsonItemDisplay');
}

function initJsonItemDisplayGrid(pColumnName, pOptions){
  console.info('>>initJsonItemDisplayGrid', pColumnName, pOptions);

    // get the region containing the column 
    //.t-Region for grid-template "standard", class t-IRR-region for template "intercative report"
  let l_region = $('#' + pColumnName).closest('.t-Region,.t-IRR-region').attr("id");
  let l_data_column = null;
  if(l_region && apex.region(l_region)){
    console.log('REGION', l_region, apex.region(l_region).widget());

    $('#' + l_region).on( 'gridpagechange', function(event, data){
      console.log('REFRESH', event, data);
      $('#' + l_region + ' .is-readonly.is-changed').removeClass('is-changed');
    });

    $('#' + l_region).on( "interactivegridviewmodelcreate", function( event, data ) {
      console.log('>>interactivegridviewmodelcreate', event, data);
      let l_view = apex.region(l_region).widget().interactiveGrid("getViews", "grid");
      let l_model = l_view.model;

      console.log('view', l_view);
      // get model columnname from grid columnname
      for (const [key, data] of Object.entries(l_view.modelColumns)) {
        if(pColumnName == data.elementId){
          l_data_column = key;
        }
      };

      l_view.modelColumns[l_data_column].dependsOn = []; 
      l_view.modelColumns[l_data_column].virtual   = true;
      l_view.modelColumns[l_data_column].readonly  = true;
      // l_view.modelColumns[l_data_column].volatile  = true;
      l_view.modelColumns[l_data_column].calcValue = function(_argsArray, model, record){
          let l_display = JSON.parse(model.getValue(record, pOptions.schemaitem));
          let l_json = JSON.parse(model.getValue(record, pOptions.dataitem));
          let l_value = formatValue(l_display, pOptions.list, l_json);
          return(l_value);
      };
      apex.region(l_region).refresh();
      console.log('<<interactivegridviewmodelcreate', l_data_column, l_view.modelColumns[l_data_column]);
    });

//  apex.item.create(pColumnName, {item_type: 'hidden', nullValue: 'xxxx', isChanged: function() { console.log('isChanged'); return false; }});

//  pOptions =convertJsonParameter(pOptions);
//  pOptions.schema = convertJsonParameter(pOptions.schema||"{}");
//  pOptions = JSON.parse(pOptions);
    pOptions.schema = pOptions.schema||{};
    pOptions.schema.apex = pOptions.schema.apex ||{};
  }else {
    // somthing whent wrong
    apex.debug.error('Column', pColumnName, 'is not part of an interactive-grid-region');
  }
  console.log('<<initJsonItemDisplayGrid');
}
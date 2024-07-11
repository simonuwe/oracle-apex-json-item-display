/*
 * APEX JSON-Item-Display plugin
 * (c) Uwe Simon 2024
 * Apache License Version 2.0
*/

"use strict";

const C_ESCAPE_VALUES = 1;
const C_ESCAPE_FORMAT = 2;

/*
 * use the format for list pList for formatting the data in pValue
 * the format contains one or more JSON-path enclosed by #
 * Example "#$.lastname#, #$.firstname#" returns "Simon, Uwe"
*/
function formatValue(pDisplay, pJSON, pEscape, pList, pValue){
  console.log('>>formatValue', pDisplay, pJSON, pList, pValue);
  pValue   = pValue?JSON.parse(pValue):null;

  let l_format  = null;

  if(pJSON && pDisplay){ // pDisplay is a JSON-schema, so parse and extract format
    pDisplay      = JSON.parse(pDisplay);
    pDisplay      = pDisplay || {};
    pDisplay.apex = pDisplay.apex || {};
    pDisplay      = pDisplay.apex.display || {};
    l_format      = pDisplay[pList]||'';    
  } else { // pDisplay contains the format-string
    l_format = pDisplay;
  }

  if(pEscape & C_ESCAPE_FORMAT ){  // escape format only when configured
    l_format = apex.util.escapeHTML(l_format);
  }

  console.log('formatValue:', l_format);

  let l_result = null;
  if(typeof pValue ==='object'){ // a value, so format the value
    l_format = '' + l_format;  // make sure l_format is a string;

    console.log('formatValue: uses format', l_format);
    l_result  = '' + l_format;
    let l_fields  = l_format.match(/#[^#]+#/g) || [];
    for(const l_field of l_fields){
      let l_jsonpath = l_field.replaceAll('#', '');
      let l_value = JSONPath.JSONPath({path: l_jsonpath, json: pValue}) || [];
      let l_val = apex.util.escapeHTML(l_value[0]);  // always escape data
      if(pEscape & C_ESCAPE_VALUES ){  // escape values or values+format
        l_val = apex.util.escapeHTML(l_val);
      }
          l_result = l_result.replaceAll(l_field, l_val?l_val:'-');
    }
  } else {
    apex.debug.error('JSON-item-display: configuration error: expected JSONs objects got schema-item:', (typeof pDisplay).toUpperCase(), 'data-item:', (typeof pValue).toUpperCase());
    l_result = 'configuration error';
  }

  console.log('<<formatValue', l_result);
  return (l_result);
}


    /*
     * initialize the JSON-Item-Display plugin when used as a page-item, call from inside PL/SQL when plugin is initialized
     */
function initJsonItemDisplay(pItemName, pOptions){
  console.info('>>initJsonItemDisplay', pItemName,  pOptions);
  let l_value = apex.item(pOptions.dataitem).getValue();
  let l_schema = pOptions.schema;

  if(pOptions.schemaitem){ // the format schema is stored in a page item
    l_schema = apex.item(pOptions.schemaitem).getValue();
  }

  l_value = (formatValue(l_schema, pOptions.json, pOptions.escape, pOptions.list, l_value))

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
                                                      "ID":    pItemName,
                                                      "VALUE": l_value
                                                   }
                                                });
  $('#' + pItemName + '_CONTAINER .t-Form-itemWrapper').html(l_html);

  apex.item.create(pItemName, {
    item_type: "json_item_display",
    displayValueFor:function(value) {
      console.log('DISPLAY:', value);
      return formatValue(pOptions.schema, pOptions.json, pOptions.escape, pOptions.list, '"' + (value ||'{}') + '"');
    }
  });
  console.log('<<initJsonItemDisplay');
}


    /*
     * initialize the JSON-Item-Display plugin when used as aN INTERACTIVE-GRID-COLUMN, call from inside PL/SQL when plugin is initialized
     */
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
      // get model name from elementid
      l_data_column = Object.keys(l_view.modelColumns).find(key => l_view.modelColumns[key].elementId === pColumnName);

      if(![pOptions.schemaitem, pOptions.dataitem].includes(l_data_column)){ 
        // calculated column must not be one of the dependent columns, otherwise endless loop
        l_model._calculatedFields = [l_data_column];

        l_view.modelColumns[l_data_column].dependsOn = [pOptions.dataitem]; 
        if(pOptions.schemaitem){
          l_view.modelColumns[l_data_column].dependsOn.push(pOptions.schemaitem);
        }

        l_view.modelColumns[l_data_column].virtual   = true;
        l_view.modelColumns[l_data_column].readonly  = true;
        // l_view.modelColumns[l_data_column].volatile  = true;
        l_view.modelColumns[l_data_column].calcValue = function(_argsArray, model, record){
//          let l_display = JSON.parse(model.getValue(record, pOptions.schemaitem));
//          let l_json = JSON.parse(model.getValue(record, pOptions.dataitem));
          let l_display = null;
          if(pOptions.schemaitem) {
            l_display = model.getValue(record, pOptions.schemaitem);
          }
          let l_json    = model.getValue(record, pOptions.dataitem);
          let l_value   = formatValue(l_display, pOptions.json, pOptions.escape, pOptions.list, l_json);
          return(l_value);
        };

        apex.region(l_region).refresh();
      } else {
        apex.debug.error('JSON-item-display: configuration error: target ', l_data_column, 'must not be any of', pOptions.schemaitem, pOptions.dataitem);
      }
      console.log('<<interactivegridviewmodelcreate', l_data_column, l_view.modelColumns[l_data_column]);
    });

    pOptions.schema = pOptions.schema||{};
    pOptions.schema.apex = pOptions.schema.apex ||{};
  }else {
    // somthing whent wrong
    apex.debug.error('Column', pColumnName, 'is not part of an interactive-grid-region');
  }
  console.log('<<initJsonItemDisplayGrid');
}
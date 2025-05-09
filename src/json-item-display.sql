/*
 * JSON-item-display 0.4.5
 * (c) Uwe Simon 2023, 2025
 * Apache License Version 2.0
 *
 * Same source base for API APEX <24.2 and >=24.2, callback API can be changed from "deprecated"
 *
 * TODO: 
 *  Remove conditional compile when min supported version is APEX >=24.2
 *
*/

/*
 * Read the JSON-schema from database. The query must return a single row and the first column must be the JSON-schema.
 */
FUNCTION readschema(pQuery IN VARCHAR2) 
  RETURN CLOB IS 
  l_json                CLOB;
  l_column_value_list   apex_plugin_util.t_column_value_list;
BEGIN
  l_column_value_list := apex_plugin_util.get_data (
            p_sql_statement    => pQuery,
            p_min_columns      => 1,
            p_max_columns      => 1,
            p_component_name   => '1');
  IF(l_column_value_list.count=1 AND l_column_value_list(1).count=1 AND l_column_value_list(1)(1) IS NOT NULL) THEN
    APEX_DEBUG.INFO('readschema: %s %s', l_column_value_list(1).count, l_column_value_list(1)(1));
    l_json := l_column_value_list(1)(1);
  END IF;
  RETURN l_json;
END readschema;

/*
 * Read the JSON-schema from database dictionary. 
 * The query must return a single row and the first column must be the JSON-schema.
 * This works only with Oracle >=23x
 * Hack, use SYS_DBURIGEN to convert LONG to CLOB!!!!
 */
FUNCTION readschemafromdictionary(pItem IN VARCHAR2) 
  RETURN CLOB IS 
  l_json                CLOB;
  l_table_name          VARCHAR2(128);
  l_column_name         VARCHAR2(128);
BEGIN
  SELECT table_name, item_source
  INTO l_table_name, l_column_name
  FROM apex_application_page_items i 
  JOIN apex_application_page_regions r ON (r.region_id=i.region_id)
  WHERE i.application_id=NV('APP_ID') AND item_name=pItem;

  APEX_DEBUG.INFO('readschemafromdictionary: %s %s', l_table_name, l_column_name);

  SELECT REGEXP_SUBSTR(text, '''(.*)''$',1,1,'n',1) AS json_schema
  INTO l_json
  FROM (
    SELECT table_name, constraint_name,
      SYS_DBURIGEN(table_name, constraint_name, search_condition, 'text()').getclob() as text 
    FROM user_constraints WHERE UPPER(search_condition_vc) like '%IS JSON%' AND constraint_type='C'
  ) c 
  JOIN user_cons_columns cc ON(c.table_name=cc.table_name AND c.constraint_name=cc.constraint_name)
  WHERE c.table_name=l_table_name AND column_name=l_column_name;

  APEX_DEBUG.INFO('JSON %s', substr(l_json,1,1000));

  RETURN l_json;
END readschemafromdictionary;
/*
 * Called when the plugin is to be rendered
 */
PROCEDURE render_json_item_display(
    p_item   in            apex_plugin.t_item,
    p_plugin in            apex_plugin.t_plugin,
    p_param  in            apex_plugin.t_item_render_param,
    p_result in out nocopy apex_plugin.t_item_render_result ) IS
  -- custom plugin attributes
  l_onload_code   VARCHAR2(4000);
  l_binds         DBMS_SQL.varchar2_table;
  l_queryitems    varchar2(4000);
  l_delimiter     varchar2(1);
  l_function      VARCHAR2(100);
  l_data_column   p_item.attribute_01%TYPE := p_item.attribute_01;                            -- the data column
  l_list          p_item.attribute_02%TYPE := NVL(p_item.attribute_02,'default');             -- The name of the format used for the list
  l_schema_column p_item.attribute_03%TYPE := p_item.attribute_03;                            -- The column with JSON-schema  
  l_schema        p_item.attribute_04%TYPE := p_item.attribute_04;                            -- The fixed JSON-schema
  l_query         p_item.attribute_05%TYPE := p_item.attribute_05;                            -- The SQL-query to retrieve the JSON-schema
  l_json          BOOLEAN;                            -- 'Y' when format is included in a JSON-schema
  l_escape        p_item.attribute_09%TYPE := p_item.attribute_09;                            -- 0 = noe escaping, 1 = escape values, 2 = espace values + format
BEGIN
$IF wwv_flow_api.c_current>=20241130
$THEN  -- new API for >= APEX_24.2, defaults can be removed when min supported version is 24.2 
  l_data_column   := p_item.attributes.get_varchar2('attribute_01', p_item.attribute_01);
  l_list          := NVL(p_item.attributes.get_varchar2('attribute_02', p_item.attribute_02),'default');
  l_schema_column := p_item.attributes.get_varchar2('attribute_03', p_item.attribute_03);
  l_schema        := p_item.attributes.get_varchar2('attribute_04', p_item.attribute_04);
  l_query         := p_item.attributes.get_varchar2('attribute_05', p_item.attribute_05);
  l_json          := p_item.attributes.get_boolean('attribute_08', UPPER(NVL(p_item.attribute_08,'Y'))='Y');
  l_escape        := p_item.attributes.get_varchar2('attribute_09', p_item.attribute_09);
$ELSE
  l_data_column   := p_item.attribute_01;
  l_list          := NVL(p_item.attribute_02,'default');
  l_schema_column := p_item.attribute_03;
  l_schema        := p_item.attribute_04;
  l_query         := p_item.attribute_05;
  l_json          := UPPER(NVL(p_item.attribute_08,'Y'))='Y';
  l_escape        := p_item.attribute_09;
$END
  BEGIN
    APEX_PLUGIN_UTIL.DEBUG_PAGE_ITEM(p_plugin, p_item, p_param.value, p_param.is_readonly, p_param.is_printer_friendly);
    APEX_DEBUG.INFO('render_json_item_display: %s-%s-%s: %s', p_item.name, l_schema_column, l_data_column, p_param.value);
    IF(l_query IS NOT NULL) THEN -- dynamic json-schema from configured query
      l_schema:=readSchema(l_query);  
    -- Build a list of queryitems required for AJAX-callback
      l_binds := wwv_flow_utilities.get_binds(l_query);
      FOR i IN 1 .. l_binds.count
      LOOP
        l_queryitems := l_queryitems||l_delimiter||'#'||substr(l_binds(i),2);
        l_delimiter:=',';
      END LOOP;
    END IF;

    IF(l_schema IS NULL OR LENGTH(l_schema)=0) THEN
      l_schema:=readschemafromdictionary(l_data_column);
    END IF;
    EXCEPTION WHEN NO_DATA_FOUND THEN
      l_schema:=NULL;
  END;

  IF p_item.component_type_id = apex_component.c_comp_type_ig_column THEN
    l_function := 'initJsonItemDisplayGrid';
  ELSE
    l_function := 'initJsonItemDisplay';
  END IF;				

  APEX_JAVASCRIPT.ADD_ONLOAD_CODE(
--       p_key=> 'json-item-display', 
      p_code => l_function||'(' ||
      apex_javascript.add_value(p_item.name) ||        
      '{' ||
          apex_javascript.add_attribute('isDynamic',  l_schema_column IS NOT NULL OR (l_query IS NOT NULL AND LENGTH(l_query)>0)) || 
          apex_javascript.add_attribute('queryitems', l_queryitems) ||
          apex_javascript.add_attribute('schemaitem', l_schema_column) || 
          apex_javascript.add_attribute('dataitem',   l_data_column) || 
          apex_javascript.add_attribute('list',       l_list) || 
          apex_javascript.add_attribute('json',       l_json) || 
          apex_javascript.add_attribute('escape',     l_escape)||
          apex_javascript.add_attribute('schema',     l_schema, false,false) ||
      '}'||
    ');'
       
  );                                 

  --p_result.is_navigable := FALSE;
END render_json_item_display;


/*
 * The AJAX callback called from inside Javascript in the browser.
 * Must return a JSON
 */

PROCEDURE ajax_json_item_display (
    p_item   in            apex_plugin.t_item,
    p_plugin in            apex_plugin.t_plugin,
    p_param  in            apex_plugin.t_item_ajax_param,
    p_result in out nocopy apex_plugin.t_item_ajax_result ) 
IS
  l_sqlquery p_item.attribute_04%TYPE :=p_item.attribute_04;  -- the SQLquery entered in page designer is passed in attribute_04;
  l_result   apex_plugin.t_item_ajax_result;
  l_json     VARCHAR2(32000);
  l_j        APEX_JSON.T_VALUES;
BEGIN
  apex_plugin_util.debug_item(p_plugin => p_plugin, p_item => p_item);
  BEGIN
    l_json := readschema(l_sqlquery);
    APEX_DEBUG.INFO('ajax_item_display: %s: %s', p_item.name, l_json);
    apex_json.parse(l_j, l_json);
    apex_json.write(l_j);
  EXCEPTION WHEN NO_DATA_FOUND THEN
    apex_json.open_object;
    apex_json.close_all;  
  END;
END ajax_json_item_display; 

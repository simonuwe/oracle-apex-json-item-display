# JSON-item-display plugin

Oracle-APEX-Plugin for displaying formatted JSON-data in interactive grids or on a page based on a format string from a JSON-schema.
The format string can reference JSON-attributes via JSON-path like
 ```Location: #$address.city.zipcode# #$.address.city#```

In reports the schema can vary from row to row, so each "object type" can have an individual display format.

This plugin can be optionally used/configured together with the JSON-Region-plugin at https://github.com/simonuwe/oracle-apex-json-region

## Screenshots
![screenshots](docu/demo.png)


## combined JSON-schema with JSON-region-plugin

A JSON-schema describing a server with a "default" output-format and a "detail" output-format. So a single JSON-schema definition can be used for displaying and editing the JSON-data.

```json
{
  "type": "object",
  "required": ["vendor", "model", "os", "purchased_at"],
  "properties": {
    "vendor":        {"type": "string", "maxLength": 20},
    "model":         {"type": "string"},
    "os":            {"type": "string"},
    "cputype":       {"type": "string"},
    "cpus":          {"type": "integer", "min": 1, "max":8},
    "cores":         {"type": "integer", "min": 1},
    "ram":           {"type": "number", "min": 0},
    "storageSize":   { "type": "integer"},
    "purchased_at":  { "type": "string", "format": "date-time"} ,
    "warranty_ends": { "type": "string", "format": "date"} 
   },
  "apex": {
    "display": {
      "default": "Server: #$.vendor# #$.model#",
      "detail":  "Server: #$.vendor# #$.model#: #$.os# #$.cpus# #$.cputype#"
    }
  }
}
```

## standalone JSON-schema for JSON-item-display-plugin

When only the JSON-item-display plugin is used the JSON-schema definition  is optional.

```json
{
  "apex": {
    "display": {
      "default": "Server: #$.vendor# #$.model#",
      "detail":  "Server: #$.vendor# #$.model#: #$.os# #$.cpus# #$.cputype#"
    }
  }
}
```

The docu for the JSON-item-display-plugin could be found [here](docu/docu.md)
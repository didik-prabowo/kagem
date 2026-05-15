"use client";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-tomorrow_night";

interface Props {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  name: string;
}

export default function SqlAceWrapper({ value, onChange, readOnly = false, name }: Props) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <AceEditor
        mode="sql"
        theme="tomorrow_night"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        name={name}
        editorProps={{ $blockScrolling: true }}
        setOptions={{ useWorker: false, tabSize: 2, useSoftTabs: true, wrap: true }}
        showPrintMargin={false}
        highlightActiveLine={!readOnly}
        width="100%"
        height="100%"
        fontSize={13}
        style={readOnly ? { cursor: "default" } : undefined}
      />
    </div>
  );
}

"use client";

import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-tomorrow_night";

interface Props {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  name?: string;
}

export default function AceWrapper({ value, onChange, readOnly = false, name = "json-editor" }: Props) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <AceEditor
        mode="json"
        theme="tomorrow_night"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        name={name}
        editorProps={{ $blockScrolling: true }}
        setOptions={{ useWorker: false, tabSize: 2, useSoftTabs: true }}
        showPrintMargin={false}
        highlightActiveLine={!readOnly}
        width="100%"
        height="100%"
        fontSize={13}
      />
    </div>
  );
}

class DcDefine {
    // Static Constants (to simulate C# 'const')
    static DBSQL = "SQL";
    static DBFBD = "FBD";
    static DBMSQ = "MSQ";

    static FULLLOCK_DOLOCK = 'D';        // Do Full Lock
    static FULLLOCK_REMOVE = 'R';        // Remove Full Lock
    static FULLLOCK_CHKSELF = 'C';       // Check Self Full Lock
    static FULLLOCK_CHKOTHER = 'O';      // Check Other Full Lock

    static CSep = "~C~";                 // Column Separator
    static RSep = "~R~";                 // Row Separator

    static DBF_TblNM = "S13F01";         // Table Name
    static DBF_FldNM = "S13F02";         // Field Name
    static DBF_DType = "S13F03";         // Data Type
    static DBF_DName = "S13F03NM";       // Data Type name (Database word of Data type)
    static DBF_Width = "S13F04";         // Field Width

    static DBF_Decim = "S13F05";         // Field Decimal
    static DBF_NoNul = "S13F61";         // Not Null Field
    static DBF_DefVL = "S13F62";         // Default Value
    static DBF_UniCD = "S13F64";         // Unicode Field Flag
}


module.exports = {DcDefine}
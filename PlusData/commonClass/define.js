class Define {
    static CSep = "~C~";   // Row Separator
    static RSep = "~R~";   // Col Separator
    static XSep = "~X~";   // Row Separator - used In S61 Columns Source separator
    static FPATHSEP = "##"; // File Path Separator to use in File upload control 

    // ... other constants ...

    // Plus Code and DB Versions
    static RDBVer = 1;   // RDB Database Verion 1,2,3 etc incremental
    static IDBVer = 1;   // IDB Database Verion 1,2,3 etc incremental
    static SDBVer = 1;   // SDB Database Verion 1,2,3 etc incremental
    static TDBVer = 1;   // TDB Database Verion 1,2,3 etc incremental
    static CDBVer = 1;   // CMP Database Verion 1,2,3 etc incremental

    static TM_ELEMENT = 15;     // Total Elements in Button String or Array
    static TM_KEYCODE = 0;      // Key Code
    static TM_KEYEXPR = 1;      // Key Expression 
    static TM_CAPTION = 2;      // Caption ID or If Value Given then Put @ before In case of Direct String
    // ... other constants ...

    static DEF_HOMECODE = "HOME-BRC";
    static DEF_HOMENAME = "Home Branch";

    static DEF_BRC_CODE = "_ALL_BRC";
    static DEF_BRC_NAME = "All Branch";


}

module.exports = Define;

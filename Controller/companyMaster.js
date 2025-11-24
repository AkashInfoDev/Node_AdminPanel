// class Company{
//     static async CreateCmp(req, res){
//             //cmpResponse p1 = JsonConvert.DeserializeObject<cmpResponse>(pa);
//             let response = {data: null, message: ''}
//             try
//             {
//                 let cErr = "";
//                 let oCmpM = new CmpMaster(p1.lCode);

//                 CurrentUser oCUser = new CurrentUser();
//                 oCUser.lCode = LangType.English;
//                 MApp.StartApp();
//                 if (MApp.AppAfterLogin(p1.CorpID, p1.cUser, p1.cPass, ref cErr, ref oCUser))
//                 {
//                     //oCmpM.GetDictionary();

//                     //oCmpM.oEntDict["FIELD01"] = !MApp.pc.NullEmpty(p1.CmpNo) ? p1.CmpNo : oCmpM.oEntDict["FIELD01"];
//                     //oCmpM.oEntDict["FIELD02"] = "Import Demo";
//                     //oCmpM.oEntDict["FIELD81"] = LangType.English;

//                     oCmpM.cAction = p1.cAction;
//                     Dictionary<string, object> oDic = JsonConvert.DeserializeObject<Dictionary<string, object>>(p1.cSData);
//                     oCmpM.oEntDict = JsonConvert.DeserializeObject<Dictionary<string, object>>(oDic["M00"].ToString());
//                     oCmpM.cCmpNo = MApp.pc.EvlSTU(oCmpM.oEntDict["FIELD01"]);
//                     p1.CmpNo = oCmpM.cCmpNo;
//                     p1.CustID = p1.CorpID;

//                     //CurrentUser oCUser = new CurrentUser();

//                     //MApp.LoadRDB(p1.CorpID, ref cErr);

//                     if (oCmpM.ValidCompany(ref cErr))
//                     {
//                         if (!oCmpM.SaveCompany(ref cErr, ref oCUser, true, p1.CustID))
//                         {
//                             resp.message = "Company  " + p1.CmpNo + " Creation Failed due to " + cErr;
//                             resp.status = "FAIL";
//                         }
//                         else
//                         {
//                             resp.message = "Company Created Successfully";
//                             resp.status = "SUCCESS";
//                         }
//                     }
//                     else
//                     {
//                         resp.message = cErr;
//                         resp.status = "FAIL";
//                     }
//                 }
//                 return Ok(resp);
//             }
//             catch (Exception ex)
//             {
//                 resp.status = "FAIL";
//                 resp.message = ex.Message;
//                 return StatusCode((int)HttpStatusCode.ExpectationFailed, resp);
//             }
//         }}
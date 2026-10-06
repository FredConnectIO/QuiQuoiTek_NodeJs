Option Explicit

''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
Sub ImportPicturesFromDirectory()
    Const sDirectory As String = "c:\a\"

    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Import d'images"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.text.TextDocument") Then
        MsgBox "Le document actif n'est pas un document Writer.", 48, "Import d'images"
        Exit Sub
    End If

    Dim oSimpleFileAccess As Object
    oSimpleFileAccess = createUnoService("com.sun.star.ucb.SimpleFileAccess")
    If Not oSimpleFileAccess.exists(ConvertToURL(sDirectory)) Then
        MsgBox "Le dossier " & sDirectory & " est introuvable.", 48, "Import d'images"
        Exit Sub
    End If

    Dim vFiles() As String
    If Not CollectImageFileNames(sDirectory, vFiles) Then
        MsgBox "Aucune image trouvee dans " & sDirectory & ".", 48, "Import d'images"
        Exit Sub
    End If

    SortStringArray vFiles

    Dim oText As Object
    Dim oCursor As Object
    oText = oDoc.getText()
    oCursor = oText.createTextCursor()
    oCursor.gotoEnd(False)

    Dim i As Long
    Dim nImported As Long
    i = 0

    Do While i <= UBound(vFiles)
        InsertTitleLine oText, oCursor, i + 1
        If ImportSinglePicture(oDoc, oText, oCursor, sDirectory & vFiles(i)) Then
            nImported = nImported + 1
            InsertLineBreak oText, oCursor
            InsertLineBreak oText, oCursor
        End If
        i = i + 1
    Loop

    MsgBox nImported & " image(s) importee(s) dans le document Writer.", 64, "Import d'images"
End Sub

Sub RenumeroterTitres1()
    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Renumerotation Titre 1"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.text.TextDocument") Then
        MsgBox "Le document actif n'est pas un document Writer.", 48, "Renumerotation Titre 1"
        Exit Sub
    End If

    Dim oParagraphs As Object
    Dim oParagraph As Object
    Dim nIndex As Long

    oParagraphs = oDoc.getText().createEnumeration()
    nIndex = 1

    Do While oParagraphs.hasMoreElements()
        oParagraph = oParagraphs.nextElement()

        If IsHeading1Paragraph(oParagraph) Then
            oParagraph.String = LetterFromIndex(nIndex) & GetHeading1TitleExtension(oParagraph.String)
            nIndex = nIndex + 1
        End If
    Loop

    Dim nRenumbered As Long
    nRenumbered = nIndex - 1
    MsgBox nRenumbered & " titre(s) 1 renumerote(s).", 64, "Renumerotation Titre 1"
End Sub

Sub RenumeroterTitres2()
    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Renumerotation Titre 2"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.text.TextDocument") Then
        MsgBox "Le document actif n'est pas un document Writer.", 48, "Renumerotation Titre 2"
        Exit Sub
    End If

    Dim oParagraphs As Object
    Dim oParagraph As Object
    Dim nHeading1Index As Long
    Dim nHeading2Index As Long
    Dim nRenumbered As Long
    Dim sHeading1Letter As String

    oParagraphs = oDoc.getText().createEnumeration()
    nHeading1Index = 0
    nHeading2Index = 1
    nRenumbered = 0
    sHeading1Letter = ""

    Do While oParagraphs.hasMoreElements()
        oParagraph = oParagraphs.nextElement()

        If IsHeading1Paragraph(oParagraph) Then
            nHeading1Index = nHeading1Index + 1
            sHeading1Letter = GetHeading1Prefix(oParagraph.String, nHeading1Index)
            nHeading2Index = 1
        ElseIf IsHeading2Paragraph(oParagraph) Then
            oParagraph.String = sHeading1Letter & Format$(nHeading2Index, "000") & GetHeading2TitleExtension(oParagraph.String)
            nHeading2Index = nHeading2Index + 1
            nRenumbered = nRenumbered + 1
        End If
    Loop

    MsgBox nRenumbered & " titre(s) 2 renumerote(s).", 64, "Renumerotation Titre 2"
End Sub

Private Function IsHeading1Paragraph(oParagraph As Object) As Boolean
    On Error GoTo NotHeading

    IsHeading1Paragraph = (oParagraph.ParaStyleName = "Heading 1")
    On Error GoTo 0
    Exit Function

NotHeading:
    IsHeading1Paragraph = False
    On Error GoTo 0
End Function

Private Function IsHeading2Paragraph(oParagraph As Object) As Boolean
    On Error GoTo NotHeading

    IsHeading2Paragraph = (oParagraph.ParaStyleName = "Heading 2")
    On Error GoTo 0
    Exit Function

NotHeading:
    IsHeading2Paragraph = False
    On Error GoTo 0
End Function

Private Function GetHeading1TitleExtension(sTitle As String) As String
    If Len(sTitle) >= 1 And IsLetter(Left$(sTitle, 1)) Then
        GetHeading1TitleExtension = Mid$(sTitle, 2)
    Else
        GetHeading1TitleExtension = ""
    End If
End Function

Private Function GetHeading2TitleExtension(sTitle As String) As String
    If Len(sTitle) >= 4 And IsLetter(Left$(sTitle, 1)) And IsNumeric(Mid$(sTitle, 2, 3)) Then
        GetHeading2TitleExtension = Mid$(sTitle, 5)
    ElseIf Len(sTitle) >= 3 And IsNumeric(Left$(sTitle, 3)) Then
        GetHeading2TitleExtension = Mid$(sTitle, 4)
    Else
        GetHeading2TitleExtension = ""
    End If
End Function

Private Function GetHeading1Prefix(sTitle As String, nIndex As Long) As String
    If Len(sTitle) >= 1 And IsLetter(Left$(sTitle, 1)) Then
        GetHeading1Prefix = LCase$(Left$(sTitle, 1))
    Else
        GetHeading1Prefix = LetterFromIndex(nIndex)
    End If
End Function

Private Function IsLetter(sValue As String) As Boolean
    Dim sLower As String
    sLower = LCase$(sValue)
    IsLetter = (sLower >= "a" And sLower <= "z")
End Function

Private Function LetterFromIndex(nIndex As Long) As String
    Dim nValue As Long
    Dim sResult As String

    nValue = nIndex
    sResult = ""

    Do While nValue > 0
        nValue = nValue - 1
        sResult = Chr$(Asc("a") + (nValue Mod 26)) & sResult
        nValue = nValue \ 26
    Loop

    LetterFromIndex = sResult
End Function

Private Function CollectImageFileNames(sDirectory As String, ByRef vFiles() As String) As Boolean
    Dim bHasFile As Boolean
    Dim sFile As String

    sFile = Dir$(sDirectory & "*.*")
    Do While sFile <> ""
        If IsSupportedImageFileName(sFile) Then
            If bHasFile Then
                ReDim Preserve vFiles(UBound(vFiles) + 1)
            Else
                ReDim vFiles(0)
                bHasFile = True
            End If
            vFiles(UBound(vFiles)) = sFile
        End If
        sFile = Dir$
    Loop

    CollectImageFileNames = bHasFile
End Function

Private Sub SortStringArray(ByRef vFiles() As String)
    Dim i As Long
    Dim j As Long
    Dim sTmp As String

    For i = 0 To UBound(vFiles) - 1
        For j = i + 1 To UBound(vFiles)
            If StrComp(vFiles(j), vFiles(i), 1) < 0 Then
                sTmp = vFiles(i)
                vFiles(i) = vFiles(j)
                vFiles(j) = sTmp
            End If
        Next j
    Next i
End Sub

Private Function ImportSinglePicture(oDoc As Object, oText As Object, oCursor As Object, sFilePath As String) As Boolean
    Const nImageWidth As Long = 17000
    Const nImageHeight As Long = 9961

    AddGraphicAtCursor oDoc, oText, oCursor, sFilePath, nImageWidth, nImageHeight
    ImportSinglePicture = True
End Function

Private Sub AddGraphicAtCursor(oDoc As Object, oText As Object, oCursor As Object, sFilePath As String, nWidth As Long, nHeight As Long)
    Dim oGraphic As Object
    oGraphic = oDoc.createInstance("com.sun.star.text.TextGraphicObject")
    oGraphic.GraphicURL = ConvertToURL(sFilePath)
    oGraphic.AnchorType = com.sun.star.text.TextContentAnchorType.AS_CHARACTER
    If nWidth > 0 And nHeight > 0 Then
        oGraphic.Width = nWidth
        oGraphic.Height = nHeight
    End If
    oText.insertTextContent oCursor, oGraphic, False
    oCursor.gotoEnd(False)
End Sub

Private Sub InsertTitleLine(oText As Object, oCursor As Object, nIndex As Long)
    oCursor.ParaStyleName = "Heading 2"
    oText.insertString oCursor, Format$(nIndex, "000"), False
    InsertLineBreak oText, oCursor
    oCursor.ParaStyleName = "Standard"
End Sub

Private Sub InsertLineBreak(oText As Object, oCursor As Object)
    oText.insertControlCharacter oCursor, com.sun.star.text.ControlCharacter.PARAGRAPH_BREAK, False
    oCursor.gotoEnd(False)
End Sub

Private Function IsSupportedImageFileName(sFileName As String) As Boolean
    Dim sLower As String
    sLower = LCase$(sFileName)

    IsSupportedImageFileName = _
        (Right$(sLower, 5) = ".webp") Or _
        (Right$(sLower, 4) = ".jpg") Or _
        (Right$(sLower, 5) = ".jpeg") Or _
        (Right$(sLower, 4) = ".png") Or _
        (Right$(sLower, 4) = ".gif") Or _
        (Right$(sLower, 4) = ".bmp") Or _
        (Right$(sLower, 4) = ".tif") Or _
        (Right$(sLower, 5) = ".tiff")
End Function

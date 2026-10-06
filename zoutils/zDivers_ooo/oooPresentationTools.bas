Option Explicit

dim lg1 As Long
dim lg2 As Long
dim lg3 As Long

''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
Sub ExtractAllImagesFromPresentation()
    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Extraction d'images"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.presentation.PresentationDocument") Then
        MsgBox "Le document actif n'est pas une présentation Impress.", 48, "Extraction d'images"
        Exit Sub
    End If

    Dim sTargetDir As String
    sTargetDir = "C:\a"

    If Len(Trim$(sTargetDir)) = 0 Then
        MsgBox "Impossible de déterminer le dossier de sortie.", 16, "Extraction d'images"
        Exit Sub
    End If

    If Not EnsureFolderExists(sTargetDir) Then
        MsgBox "Impossible de créer le dossier: " & sTargetDir, 16, "Extraction d'images"
        Exit Sub
    End If

    Dim nExported As Long
    nExported = ExportImagesFromSlides(oDoc, sTargetDir)

    If nExported = 0 Then
        MsgBox "Aucune image trouvée.", 48, "Extraction d'images"
    Else
        MsgBox nExported & " image(s) exportée(s) vers:" & Chr(13) & sTargetDir, 64, "Extraction d'images"
    End If
End Sub

Private Function ExportImagesFromSlides(oDoc As Object, sTargetDir As String) As Long
    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim nSlideIndex As Long
    Dim nExported As Long

    For nSlideIndex = 0 To oDrawPages.getCount() - 1
        ExportImagesFromShapeContainer oDrawPages.getByIndex(nSlideIndex), sTargetDir, nSlideIndex + 1, nExported
    Next nSlideIndex

    ExportImagesFromSlides = nExported
End Function

Private Sub ExportImagesFromShapeContainer(oContainer As Object, sTargetDir As String, nSlideNumber As Long, ByRef nExported As Long)
    If Not HasUnoInterfaces(oContainer, "com.sun.star.drawing.XShapes") Then
        Exit Sub
    End If

    Dim n As Long
    Dim oShape As Object

    For n = 0 To oContainer.getCount() - 1
        oShape = oContainer.getByIndex(n)

        If oShape.supportsService("com.sun.star.drawing.GroupShape") Then
            ExportImagesFromShapeContainer oShape, sTargetDir, nSlideNumber, nExported
        ElseIf oShape.supportsService("com.sun.star.drawing.GraphicObjectShape") Then
            ExportSingleGraphic oShape, sTargetDir, nSlideNumber, nExported
        End If
    Next n
End Sub

Private Sub ExportSingleGraphic(oShape As Object, sTargetDir As String, nSlideNumber As Long, ByRef nExported As Long)
    On Error GoTo HandleError

    Dim oGraphic As Object
    oGraphic = oShape.Graphic

    If oGraphic Is Nothing Then
        Exit Sub
    End If

    Dim sExtension As String
    sExtension = ResolveGraphicExtension(oShape, oGraphic)

    Dim sMimeType As String
    sMimeType = MimeTypeFromExtension(sExtension)

    Dim sFileName As String
    sFileName = "slide_" & Format$(nSlideNumber, "000") & "_image_" & Format$(nExported + 1, "0000") & "." & sExtension

    Dim sFilePath As String
    sFilePath = JoinPath(sTargetDir, sFileName)

    Dim oGraphicProvider As Object
    oGraphicProvider = createUnoService("com.sun.star.graphic.GraphicProvider")

    Dim aStoreProps(1) As New com.sun.star.beans.PropertyValue
    aStoreProps(0).Name = "URL"
    aStoreProps(0).Value = ConvertToURL(sFilePath)
    aStoreProps(1).Name = "MimeType"
    aStoreProps(1).Value = sMimeType

    oGraphicProvider.storeGraphic oGraphic, aStoreProps()
    nExported = nExported + 1
    Exit Sub

HandleError:
    Err.Clear
    On Error GoTo 0
End Sub

Private Function ResolveGraphicExtension(oShape As Object, oGraphic As Object) As String
    On Error GoTo Fallback

    Dim oGraphicProvider As Object
    oGraphicProvider = createUnoService("com.sun.star.graphic.GraphicProvider")

    Dim aDescProps(0) As New com.sun.star.beans.PropertyValue
    aDescProps(0).Name = "Graphic"
    aDescProps(0).Value = oGraphic

    Dim oDescriptor As Object
    oDescriptor = oGraphicProvider.queryGraphicDescriptor(aDescProps())

    If oDescriptor Is Nothing Then
        ResolveGraphicExtension = ExtensionFromGraphicURL(oShape)
        Exit Function
    End If

    Dim sMime As String
    sMime = LCase$(Trim$(oDescriptor.MimeType))

    Select Case sMime
        Case "image/jpeg": ResolveGraphicExtension = "jpg"
        Case "image/png": ResolveGraphicExtension = "png"
        Case "image/gif": ResolveGraphicExtension = "gif"
        Case "image/bmp": ResolveGraphicExtension = "bmp"
        Case "image/tiff": ResolveGraphicExtension = "tif"
        Case "image/webp": ResolveGraphicExtension = "webp"
        Case Else: ResolveGraphicExtension = ExtensionFromGraphicURL(oShape)
    End Select
    Exit Function

Fallback:
    ResolveGraphicExtension = ExtensionFromGraphicURL(oShape)
    Err.Clear
    On Error GoTo 0
End Function

Private Function ExtensionFromGraphicURL(oShape As Object) As String
    On Error GoTo Fallback

    Dim vGraphicURL As Variant
    Dim sUrl As String
    Dim sToken As String

    sUrl = ""
    vGraphicURL = oShape.GraphicURL

    If IsObject(vGraphicURL) Then
        On Error Resume Next
        sUrl = CStr(vGraphicURL.MimeType)
        If Len(Trim$(sUrl)) = 0 Then
            sUrl = CStr(vGraphicURL)
        End If
        On Error GoTo Fallback
    ElseIf Not IsNull(vGraphicURL) Then
        sUrl = CStr(vGraphicURL)
    End If

    sToken = LCase$(Trim$(sUrl))
    If Left$(sToken, 5) = "mime/" Then
        sToken = Mid$(sToken, 6)
    End If
    If Left$(sToken, 6) = "image/" Then
        sToken = Mid$(sToken, 7)
    End If

    If InStr(1, sToken, "jpeg", 1) > 0 Or InStr(1, sToken, ".jpg", 1) > 0 Then
        ExtensionFromGraphicURL = "jpg"
        Exit Function
    End If
    If InStr(1, sToken, "png", 1) > 0 Then
        ExtensionFromGraphicURL = "png"
        Exit Function
    End If
    If InStr(1, sToken, "gif", 1) > 0 Then
        ExtensionFromGraphicURL = "gif"
        Exit Function
    End If
    If InStr(1, sToken, "bmp", 1) > 0 Then
        ExtensionFromGraphicURL = "bmp"
        Exit Function
    End If
    If InStr(1, sToken, "tiff", 1) > 0 Or InStr(1, sToken, "tif", 1) > 0 Then
        ExtensionFromGraphicURL = "tif"
        Exit Function
    End If
    If InStr(1, sToken, "webp", 1) > 0 Then
        ExtensionFromGraphicURL = "webp"
        Exit Function
    End If

Fallback:
    ExtensionFromGraphicURL = "png"
    Err.Clear
    On Error GoTo 0
End Function

Private Function MimeTypeFromExtension(sExtension As String) As String
    Select Case LCase$(sExtension)
        Case "jpg", "jpeg": MimeTypeFromExtension = "image/jpeg"
        Case "gif": MimeTypeFromExtension = "image/gif"
        Case "bmp": MimeTypeFromExtension = "image/bmp"
        Case "tif", "tiff": MimeTypeFromExtension = "image/tiff"
        Case "webp": MimeTypeFromExtension = "image/webp"
        Case Else: MimeTypeFromExtension = "image/png"
    End Select
End Function

Private Function JoinPath(sLeft As String, sRight As String) As String
    Dim sSep As String
    sSep = GetPathSeparator()

    If Right$(sLeft, 1) = sSep Then
        JoinPath = sLeft & sRight
    Else
        JoinPath = sLeft & sSep & sRight
    End If
End Function

Private Function GetPathSeparator() As String
    If InStr(1, Environ$("OS"), "Windows", 1) > 0 Then
        GetPathSeparator = "\"
    Else
        GetPathSeparator = "/"
    End If
End Function

Private Function EnsureFolderExists(sFolderPath As String) As Boolean
    On Error GoTo Failed

    Dim oSimpleFileAccess As Object
    oSimpleFileAccess = createUnoService("com.sun.star.ucb.SimpleFileAccess")

    Dim sFolderUrl As String
    sFolderUrl = ConvertToURL(sFolderPath)

    If Not oSimpleFileAccess.exists(sFolderUrl) Then
        oSimpleFileAccess.createFolder sFolderUrl
    End If

    EnsureFolderExists = oSimpleFileAccess.exists(sFolderUrl)
    Exit Function

Failed:
    EnsureFolderExists = False
    Err.Clear
    On Error GoTo 0
End Function



''''''''''''''''''''''''''''''''''''''''''''''''''''''''''


Sub ImportPicturesFromDirectory()
    Const sDirectory As String = "c:\a\"
    
    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Import d'images"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.presentation.PresentationDocument") Then
        MsgBox "Le document actif n'est pas une présentation Impress.", 48, "Import d'images"
        Exit Sub
    End If

    Dim oSimpleFileAccess As Object
    oSimpleFileAccess = createUnoService("com.sun.star.ucb.SimpleFileAccess")
    If Not oSimpleFileAccess.exists(ConvertToURL(sDirectory)) Then
        MsgBox "Le dossier " & sDirectory & " est introuvable.", 48, "Import d'images"
        Exit Sub
    End If

    Dim vFiles() As String
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

    If Not bHasFile Then
        MsgBox "Aucune image trouvée dans " & sDirectory & ".", 48, "Import d'images"
        Exit Sub
    End If

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

    Dim nImported As Long
    i = 0
    Do While i <= UBound(vFiles)
        If i < UBound(vFiles) Then
            If ImportPicturePairIfFits(oDoc, sDirectory & vFiles(i), sDirectory & vFiles(i + 1)) Then
                nImported = nImported + 2
                i = i + 2
                GoTo ContinueLoop
            End If
        End If

        ImportSinglePicture oDoc, sDirectory & vFiles(i)
        nImported = nImported + 1
        i = i + 1
ContinueLoop:
    Loop

    MsgBox nImported & " image(s) importée(s) dans la présentation.", 64, "Import d'images"

    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    If nImported > 0 And oDrawPages.getCount() > 0 Then
        oDrawPages.remove(oDrawPages.getByIndex(0))
    End If

    Dim oPresentation As Object
    oPresentation = oDoc.getPresentation()
    SetPropertyIfAvailable oPresentation, "IsEndless", True
    SetPropertyIfAvailable oPresentation, "Pause", 0
End Sub

Private Function ImportPicturePairIfFits(oDoc As Object, sFilePathLeft As String, sFilePathRight As String) As Boolean
    Const nGap As Long = 200

    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim oPage As Object
    oPage = oDrawPages.insertNewByIndex(oDrawPages.getCount())

    Dim nPageW As Long
    Dim nPageH As Long
    nPageW = oPage.Width
    nPageH = oPage.Height

    Dim nW1 As Long
    Dim nH1 As Long
    Dim nW2 As Long
    Dim nH2 As Long
    Dim bOk1 As Boolean
    Dim bOk2 As Boolean

    bOk1 = TryGetImageSize100thMM(sFilePathLeft, nW1, nH1)
    bOk2 = TryGetImageSize100thMM(sFilePathRight, nW2, nH2)

    If Not bOk1 Or Not bOk2 Then
        oDrawPages.remove(oPage)
        ImportPicturePairIfFits = False
        Exit Function
    End If

    If nH1 <= 0 Or nH2 <= 0 Then
        oDrawPages.remove(oPage)
        ImportPicturePairIfFits = False
        Exit Function
    End If

    Dim nScaledW1 As Long
    Dim nScaledW2 As Long
    nScaledW1 = CLng((CDbl(nW1) * nPageH) / nH1)
    nScaledW2 = CLng((CDbl(nW2) * nPageH) / nH2)

    If (nScaledW1 + nGap + nScaledW2) > nPageW Then
        oDrawPages.remove(oPage)
        ImportPicturePairIfFits = False
        Exit Function
    End If

    On Error Resume Next
    oPage.FillStyle = com.sun.star.drawing.FillStyle.SOLID
    oPage.FillColor = RGB(0, 0, 0)
    oPage.BackColor = RGB(0, 0, 0)
    On Error GoTo 0

    Dim oShape1 As Object
    Dim oShape2 As Object
    oShape1 = oDoc.createInstance("com.sun.star.drawing.GraphicObjectShape")
    oShape2 = oDoc.createInstance("com.sun.star.drawing.GraphicObjectShape")
    oShape1.GraphicURL = ConvertToURL(sFilePathLeft)
    oShape2.GraphicURL = ConvertToURL(sFilePathRight)

    Dim aSize1 As New com.sun.star.awt.Size
    Dim aSize2 As New com.sun.star.awt.Size
    aSize1.Width = nScaledW1
    aSize1.Height = nPageH
    aSize2.Width = nScaledW2
    aSize2.Height = nPageH

    Dim nStartX As Long
    nStartX = (nPageW - (aSize1.Width + nGap + aSize2.Width)) \ 2

    Dim aPos1 As New com.sun.star.awt.Point
    Dim aPos2 As New com.sun.star.awt.Point
    aPos1.X = nStartX
    aPos1.Y = 0
    aPos2.X = nStartX + aSize1.Width + nGap
    aPos2.Y = 0

    oShape1.setPosition(aPos1)
    oShape1.setSize(aSize1)
    oShape2.setPosition(aPos2)
    oShape2.setSize(aSize2)

    oPage.add(oShape1)
    oPage.add(oShape2)

    ImportPicturePairIfFits = True
End Function

Private Function TryGetImageSize100thMM(sFilePath As String, ByRef nWidth As Long, ByRef nHeight As Long) As Boolean
    On Error GoTo Failed

    Dim oGraphicProvider As Object
    oGraphicProvider = createUnoService("com.sun.star.graphic.GraphicProvider")

    Dim aGraphicProps(0) As New com.sun.star.beans.PropertyValue
    aGraphicProps(0).Name = "URL"
    aGraphicProps(0).Value = ConvertToURL(sFilePath)

    Dim aGraphicSize As New com.sun.star.awt.Size
    aGraphicSize = oGraphicProvider.queryGraphic(aGraphicProps()).Size100thMM

    If aGraphicSize.Width > 0 And aGraphicSize.Height > 0 Then
        nWidth = CLng(aGraphicSize.Width)
        nHeight = CLng(aGraphicSize.Height)
        TryGetImageSize100thMM = True
        Exit Function
    End If

Failed:
    nWidth = 0
    nHeight = 0
    TryGetImageSize100thMM = False
    Err.Clear
    On Error GoTo 0
End Function

Sub ImportVignettesFromDirectory()
    Const sDirectory As String = "C:\a\resized\"
    Const nMargin As Long = 200      ' 2 mm
    Const nGapX As Long = 100        ' 1 mm
    Const nGapY As Long = 100        ' 1 mm

    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Import de vignettes"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.presentation.PresentationDocument") Then
        MsgBox "Le document actif n'est pas une présentation Impress.", 48, "Import de vignettes"
        Exit Sub
    End If

    Dim oSimpleFileAccess As Object
    oSimpleFileAccess = createUnoService("com.sun.star.ucb.SimpleFileAccess")
    If Not oSimpleFileAccess.exists(ConvertToURL(sDirectory)) Then
        MsgBox "Le dossier " & sDirectory & " est introuvable.", 48, "Import de vignettes"
        Exit Sub
    End If

    Dim vFiles() As String
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

    If Not bHasFile Then
        MsgBox "Aucune vignette trouvée dans " & sDirectory & ".", 48, "Import de vignettes"
        Exit Sub
    End If

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

    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim oPage As Object
    oPage = oDrawPages.insertNewByIndex(oDrawPages.getCount())

    Dim nCurX As Long
    Dim nCurY As Long
    Dim nRowHeight As Long
    nCurX = nMargin
    nCurY = nMargin
    nRowHeight = 0

    Dim nImported As Long
    Dim nSlidesUsed As Long
    nSlidesUsed = 1

    For i = 0 To UBound(vFiles)
        If PlaceSingleVignette(oDoc, oPage, sDirectory & vFiles(i), nMargin, nGapX, nGapY, nCurX, nCurY, nRowHeight, oDrawPages, nSlidesUsed) Then
            nImported = nImported + 1
        End If
    Next i

    If nImported = 0 Then
        MsgBox "Aucune vignette trouvée dans " & sDirectory & ".", 48, "Import de vignettes"
    Else
        MsgBox nImported & " vignette(s) importée(s) sur " & nSlidesUsed & " diapo(s).", 64, "Import de vignettes"
    End If
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

Sub ImportVignettesWithTextFromDirectory()
    Const sDirectory As String = "C:\a\resized\"
    Const nSlotsPerSlide As Long = 4
    Const nImageRightX As Long = 4500   ' 4.5 cm
    Const nTextX As Long = 4800         ' 4.8 cm
    Const nTextWidth As Long = 23200    ' 23.2 cm
    Const nTextFontSize As Double = 18
    Const nSlotPadding As Long = 120

    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Import vignettes + texte"
        Exit Sub
    End If

    If Not oDoc.supportsService("com.sun.star.presentation.PresentationDocument") Then
        MsgBox "Le document actif n'est pas une présentation Impress.", 48, "Import vignettes + texte"
        Exit Sub
    End If

    Dim oSimpleFileAccess As Object
    oSimpleFileAccess = createUnoService("com.sun.star.ucb.SimpleFileAccess")
    If Not oSimpleFileAccess.exists(ConvertToURL(sDirectory)) Then
        MsgBox "Le dossier " & sDirectory & " est introuvable.", 48, "Import vignettes + texte"
        Exit Sub
    End If

    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim aExtensions As Variant
    aExtensions = Array("*.webp", "*.jpg", "*.jpeg", "*.png", "*.gif", "*.bmp", "*.tif", "*.tiff")

    Dim nImported As Long
    Dim nSlidesUsed As Long
    Dim nCurrentSlot As Long
    Dim oPage As Object
    Dim nPageW As Long
    Dim nPageH As Long
    Dim nSlotHeight As Long

    Dim sFile As String
    Dim i As Integer
    For i = LBound(aExtensions) To UBound(aExtensions)
        sFile = Dir$(sDirectory & aExtensions(i))
        Do While sFile <> ""
            If (nImported Mod nSlotsPerSlide) = 0 Then
                oPage = oDrawPages.insertNewByIndex(oDrawPages.getCount())
                nSlidesUsed = nSlidesUsed + 1
                nCurrentSlot = 0
                nPageW = oPage.Width
                nPageH = oPage.Height
                nSlotHeight = nPageH \ nSlotsPerSlide
            End If

            If AddVignetteAndTextToSlot(oDoc, oPage, sDirectory & sFile, sFile, nCurrentSlot, nSlotHeight, nPageW, nPageH, nImageRightX, nTextX, nTextWidth, nTextFontSize, nSlotPadding) Then
                nImported = nImported + 1
                nCurrentSlot = nCurrentSlot + 1
            End If

            sFile = Dir$
        Loop
    Next i

    If nImported = 0 Then
        MsgBox "Aucune vignette trouvée dans " & sDirectory & ".", 48, "Import vignettes + texte"
    Else
        MsgBox nImported & " vignette(s) importée(s) sur " & nSlidesUsed & " diapo(s).", 64, "Import vignettes + texte"
    End If
End Sub

Private Function AddVignetteAndTextToSlot(oDoc As Object, oPage As Object, sFilePath As String, sFileName As String, nSlotIndex As Long, nSlotHeight As Long, nPageW As Long, nPageH As Long, nImageRightX As Long, nTextX As Long, nTextWidth As Long, nTextFontSize As Double, nSlotPadding As Long) As Boolean
    On Error GoTo Failed

    Dim nImgW As Long
    Dim nImgH As Long
    If Not GetVignetteSize100thMM(sFilePath, nImgW, nImgH) Then
        AddVignetteAndTextToSlot = False
        Exit Function
    End If

    Dim nMaxW As Long
    Dim nMaxH As Long
    nMaxW = nImageRightX
    nMaxH = nSlotHeight - (2 * nSlotPadding)
    If nMaxH < 100 Then nMaxH = 100
    FitSizeInside nImgW, nImgH, nMaxW, nMaxH

    Dim nSlotTop As Long
    nSlotTop = nSlotIndex * nSlotHeight

    Dim nImgX As Long
    Dim nImgY As Long
    nImgX = nImageRightX - nImgW
    If nImgX < 0 Then nImgX = 0
    nImgY = nSlotTop + ((nSlotHeight - nImgH) \ 2)
    If nImgY < 0 Then nImgY = 0

    Dim oImage As Object
    oImage = oDoc.createInstance("com.sun.star.drawing.GraphicObjectShape")
    oImage.GraphicURL = ConvertToURL(sFilePath)

    Dim aImgPos As New com.sun.star.awt.Point
    aImgPos.X = nImgX
    aImgPos.Y = nImgY
    oImage.setPosition(aImgPos)

    Dim aImgSize As New com.sun.star.awt.Size
    aImgSize.Width = nImgW
    aImgSize.Height = nImgH
    oImage.setSize(aImgSize)
    oPage.add(oImage)

    Dim nRealTextWidth As Long
    nRealTextWidth = nTextWidth
    If nTextX + nRealTextWidth > nPageW Then
        nRealTextWidth = nPageW - nTextX
        If nRealTextWidth < 1000 Then nRealTextWidth = 1000
    End If

    Dim nTextH As Long
    nTextH = nSlotHeight - (2 * nSlotPadding)
    If nTextH < 1000 Then nTextH = 1000

    Dim nTextY As Long
    nTextY = nSlotTop + ((nSlotHeight - nTextH) \ 2)
    If nTextY < 0 Then nTextY = 0

    Dim oText As Object
    oText = oDoc.createInstance("com.sun.star.drawing.TextShape")

    Dim aTxtPos As New com.sun.star.awt.Point
    aTxtPos.X = nTextX
    aTxtPos.Y = nTextY
    oText.setPosition(aTxtPos)

    Dim aTxtSize As New com.sun.star.awt.Size
    aTxtSize.Width = nRealTextWidth
    aTxtSize.Height = nTextH
    oText.setSize(aTxtSize)

    oText.String = RemoveFileExtension(sFileName)
    On Error Resume Next
    oText.CharHeight = nTextFontSize
    On Error GoTo Failed

    oPage.add(oText)
    AddVignetteAndTextToSlot = True
    Exit Function

Failed:
    AddVignetteAndTextToSlot = False
    Err.Clear
    On Error GoTo 0
End Function

Private Function RemoveFileExtension(sFileName As String) As String
    Dim i As Long
    For i = Len(sFileName) To 1 Step -1
        If Mid$(sFileName, i, 1) = "." Then
            RemoveFileExtension = Left$(sFileName, i - 1)
            Exit Function
        End If
    Next i
    RemoveFileExtension = sFileName
End Function

Private Function PlaceSingleVignette(oDoc As Object, ByRef oPage As Object, sFilePath As String, nMargin As Long, nGapX As Long, nGapY As Long, ByRef nCurX As Long, ByRef nCurY As Long, ByRef nRowHeight As Long, oDrawPages As Object, ByRef nSlidesUsed As Long) As Boolean
    Dim nImgW As Long
    Dim nImgH As Long

    If Not GetVignetteSize100thMM(sFilePath, nImgW, nImgH) Then
        PlaceSingleVignette = False
        Exit Function
    End If

    Dim nPageW As Long
    Dim nPageH As Long
    nPageW = oPage.Width
    nPageH = oPage.Height

    Dim nInnerW As Long
    Dim nInnerH As Long
    nInnerW = nPageW - (2 * nMargin)
    nInnerH = nPageH - (2 * nMargin)

    If nInnerW <= 0 Or nInnerH <= 0 Then
        PlaceSingleVignette = False
        Exit Function
    End If

    FitSizeInside nImgW, nImgH, nInnerW, nInnerH

    If nCurX + nImgW > nPageW - nMargin Then
        nCurX = nMargin
        nCurY = nCurY + nRowHeight + nGapY
        nRowHeight = 0
    End If

    If nCurY + nImgH > nPageH - nMargin Then
        oPage = oDrawPages.insertNewByIndex(oDrawPages.getCount())
        nSlidesUsed = nSlidesUsed + 1
        nCurX = nMargin
        nCurY = nMargin
        nRowHeight = 0
        nPageW = oPage.Width
        nPageH = oPage.Height
    End If

    Dim oShape As Object
    oShape = oDoc.createInstance("com.sun.star.drawing.GraphicObjectShape")
    oShape.GraphicURL = ConvertToURL(sFilePath)

    Dim aPoint As New com.sun.star.awt.Point
    aPoint.X = nCurX
    aPoint.Y = nCurY
    oShape.setPosition(aPoint)

    Dim aSize As New com.sun.star.awt.Size
    aSize.Width = nImgW
    aSize.Height = nImgH
    oShape.setSize(aSize)

    oPage.add(oShape)

    nCurX = nCurX + nImgW + nGapX
    If nImgH > nRowHeight Then
        nRowHeight = nImgH
    End If

    PlaceSingleVignette = True
End Function

Private Function GetVignetteSize100thMM(sFilePath As String, ByRef nWidth As Long, ByRef nHeight As Long) As Boolean
    On Error GoTo Failed

    Const dPxTo100thMM As Double = 26.4583333333

    Dim oGraphicProvider As Object
    oGraphicProvider = createUnoService("com.sun.star.graphic.GraphicProvider")

    Dim aProps(0) As New com.sun.star.beans.PropertyValue
    aProps(0).Name = "URL"
    aProps(0).Value = ConvertToURL(sFilePath)

    Dim oDescriptor As Object
    oDescriptor = oGraphicProvider.queryGraphicDescriptor(aProps())

    If Not (oDescriptor Is Nothing) Then
        Dim vPixelSize As Variant
        vPixelSize = oDescriptor.SizePixel

        If Not IsEmpty(vPixelSize) Then
            If vPixelSize.Width > 0 And vPixelSize.Height > 0 Then
                nWidth = CLng(vPixelSize.Width * dPxTo100thMM)
                nHeight = CLng(vPixelSize.Height * dPxTo100thMM)
                GetVignetteSize100thMM = True
                Exit Function
            End If
        End If

        Dim vSize100thMM As Variant
        vSize100thMM = oDescriptor.Size100thMM
        If Not IsEmpty(vSize100thMM) Then
            If vSize100thMM.Width > 0 And vSize100thMM.Height > 0 Then
                nWidth = CLng(vSize100thMM.Width)
                nHeight = CLng(vSize100thMM.Height)
                GetVignetteSize100thMM = True
                Exit Function
            End If
        End If
    End If

Failed:
    nWidth = 0
    nHeight = 0
    GetVignetteSize100thMM = False
    Err.Clear
    On Error GoTo 0
End Function

Private Sub FitSizeInside(ByRef nWidth As Long, ByRef nHeight As Long, nMaxW As Long, nMaxH As Long)
    If nWidth <= 0 Or nHeight <= 0 Then Exit Sub
    If nMaxW <= 0 Or nMaxH <= 0 Then Exit Sub

    Dim dScaleW As Double
    Dim dScaleH As Double
    Dim dScale As Double

    dScaleW = nMaxW / nWidth
    dScaleH = nMaxH / nHeight
    dScale = dScaleW
    If dScaleH < dScale Then dScale = dScaleH

    If dScale < 1 Then
        nWidth = CLng(nWidth * dScale)
        nHeight = CLng(nHeight * dScale)
    End If
End Sub

Private Sub ImportSinglePicture(oDoc As Object, sFilePath As String)
    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim oPage As Object
    oPage = oDrawPages.insertNewByIndex(oDrawPages.getCount())

    On Error Resume Next
    oPage.FillStyle = com.sun.star.drawing.FillStyle.SOLID
    oPage.FillColor = RGB(0, 0, 0)
    oPage.BackColor = RGB(0, 0, 0)
    On Error GoTo 0

    Dim oShape As Object
    oShape = oDoc.createInstance("com.sun.star.drawing.GraphicObjectShape")

    Dim sURL As String
    sURL = ConvertToURL(sFilePath)
    oShape.GraphicURL = sURL
    
    Dim oGraphicProvider As Object
    oGraphicProvider = createUnoService("com.sun.star.graphic.GraphicProvider")

    Dim aGraphicProps(0) As New com.sun.star.beans.PropertyValue
    aGraphicProps(0).Name = "URL"
    aGraphicProps(0).Value = sURL

    Dim oPageProps As Object
    oPageProps = oPage

    Dim aPageSize As New com.sun.star.awt.Size
    aPageSize.Width = oPageProps.Width
    aPageSize.Height = oPageProps.Height

    Dim aGraphicSize As New com.sun.star.awt.Size
    Dim bHasGraphicSize As Boolean
    Dim vPixelSize As Variant
    Dim bHasAspectRatio As Boolean
    Dim vDescriptor As Variant
    Dim nErr As Long
    Dim i As Long
    Dim dAspect As Double
    Dim lPixelWidth As Long
    Dim lPixelHeight As Long
    Dim dWidthFromRatio As Double
    Dim dHeightFromRatio As Double

    On Error Resume Next
    aGraphicSize = oGraphicProvider.queryGraphic(aGraphicProps()).Size100thMM
    nErr = Err
    On Error GoTo 0

    bHasGraphicSize = (nErr = 0 And aGraphicSize.Width > 0 And aGraphicSize.Height > 0)

    If nErr <> 0 Then
        Err.Clear
        nErr = 0
    End If

    If Not bHasGraphicSize Then
        On Error Resume Next
        vDescriptor = oGraphicProvider.queryGraphicDescriptor(aGraphicProps())
        nErr = Err
        On Error GoTo 0

        vPixelSize = vDescriptor.SizePixel

    End If

    If Not bHasGraphicSize Then
        If Not IsEmpty(vPixelSize) Then
            lPixelWidth = vPixelSize.Width
            lPixelHeight = vPixelSize.Height

            If lPixelWidth > 0 And lPixelHeight > 0 Then
                dAspect = lPixelWidth / lPixelHeight
                bHasAspectRatio = True
            End If
        End If
    End If

    Dim aTargetSize As New com.sun.star.awt.Size
    If bHasGraphicSize Then
        Dim dScaleW As Double
        Dim dScaleH As Double
        Dim dScale As Double

        dScaleW = aPageSize.Width / aGraphicSize.Width
        dScaleH = aPageSize.Height / aGraphicSize.Height

        If dScaleW < dScaleH Then
            dScale = dScaleW
        Else
            dScale = dScaleH
        End If

        aTargetSize.Width = CLng(aGraphicSize.Width * dScale)
        aTargetSize.Height = CLng(aGraphicSize.Height * dScale)
    ElseIf bHasAspectRatio Then
        dWidthFromRatio = aPageSize.Height * dAspect
        dHeightFromRatio = aPageSize.Width / dAspect

        If dWidthFromRatio <= aPageSize.Width Then
            aTargetSize.Height = aPageSize.Height
            aTargetSize.Width = CLng(dWidthFromRatio)
        Else
            aTargetSize.Width = aPageSize.Width
            aTargetSize.Height = CLng(dHeightFromRatio)
        End If
    Else
        aTargetSize.Width = aPageSize.Width
        aTargetSize.Height = aPageSize.Height
    End If

    Dim aPoint As New com.sun.star.awt.Point
    aPoint.X = (aPageSize.Width - aTargetSize.Width) \ 2
    aPoint.Y = (aPageSize.Height - aTargetSize.Height) \ 2

    oShape.setPosition(aPoint)
    oShape.setSize(aTargetSize)

    oPage.add(oShape)
End Sub

Private Sub SetAllSlidesBackgroundToBlack()

    lg1 = InputBox("Rouge (0-255) :", "Couleur RGB")
    lg2 = InputBox("Vert (0-255) :", "Couleur RGB")
    lg3 = InputBox("Bleu (0-255) :", "Couleur RGB")
	Dim oDoc As Object
    oDoc = ThisComponent
    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim lgIndex As Long
    Dim oPage As Object
	
    For lgIndex = 0 To oDrawPages.getCount() - 1
        oPage = oDrawPages.getByIndex(lgIndex)
        SetPageBackgroundToBlack(oPage)
    Next lgIndex
End Sub

Private Sub SetPageBackgroundToBlack(oPage As Object)
    Dim oDoc As Object
    oDoc = ThisComponent
    Dim oBackground As Object

    If IsNull(oPage.Background) Or IsEmpty(oPage.Background) Then
        oBackground = oDoc.createInstance("com.sun.star.drawing.Background")
    else
        oBackground = oPage.Background
    End If
    
    oBackground.FillStyle = 1
    oBackground.FillColor = rgb(lg1, lg2, lg3)
    oPage.Background = oBackground
End Sub


Sub ModifTransition()
   
    Dim oDoc As Object
    oDoc = ThisComponent

    If oDoc Is Nothing Then
        MsgBox "Aucun document n'est ouvert.", 48, "Import d'images"
        Exit Sub
    End If

    Dim oDrawPages As Object
    oDrawPages = oDoc.getDrawPages()

    Dim nSlideIndex As Long
    Dim oSlide As Object
    For nSlideIndex = 0 To oDrawPages.getCount() - 1
        oSlide = oDrawPages.getByIndex(nSlideIndex)
        'SetPropertyIfAvailable oSlide, "TransitionOnClick", True
        'SetPropertyIfAvailable oSlide, "IsTransitionOnClick", True
        'SetPropertyIfAvailable oSlide, "TransitionOnTime", True
        'SetPropertyIfAvailable oSlide, "IsTransitionOnTime", True
        'SetPropertyIfAvailable oSlide, "TransitionTime", 1
        SetPropertyIfAvailable oSlide, "Duration", 2
        SetPropertyIfAvailable oSlide, "TransitionDuration", 3
    Next nSlideIndex

End Sub

Sub ouvrirTout()
    On Error GoTo ErrorHandler

    Dim sDirectory As String
    Dim sDirectoryURL As String
    Dim oSimple As Object
    Dim aEntries As Variant
    Dim vFiles() As String
    Dim bHasFile As Boolean
    
    Dim i As Long
    Dim j As Long
    Dim sFileURL As String
    Dim sDisplayName As String
    Dim sNextDisplayName As String
    Dim nAnswer As Integer
    Dim sSofficePath As String
    Dim sCommand As String
    Dim nShellResult As Long
    Dim nExitCode As Long

    Dim saisie As String
	Dim  param As String
	sDirectory = "D:\zzz\xTestlof1\dia"
	Dim oPicker As Object
	oPicker = createUnoService("com.sun.star.ui.dialogs.FolderPicker")
	oPicker.setDisplayDirectory(ConvertToURL(sDirectory))
	If oPicker.execute() = 1 Then
	    sDirectory = ConvertFromURL(oPicker.getDirectory())
	End If
	param="show"
	param = InputBox(" mode d'ouverture", "show ou vide", param)

    If Trim(sDirectory) = "" Then
        MsgBox "Impossible de déterminer le répertoire en cours.", 48, "ouvrirTout"
        Exit Sub
    End If

    sDirectoryURL = ConvertToURL(sDirectory)

    oSimple = createUnoService("com.sun.star.ucb.SimpleFileAccess")
    If oSimple Is Nothing Then
        MsgBox "Service SimpleFileAccess indisponible.", 16, "ouvrirTout"
        Exit Sub
    End If

    If Not oSimple.exists(sDirectoryURL) Then
        MsgBox "Le répertoire """ & sDirectory & """ est introuvable.", 48, "ouvrirTout"
        Exit Sub
    End If

    aEntries = oSimple.getFolderContents(sDirectoryURL, False)

    ReDim vFiles(0)
    bHasFile = False
    If IsArray(aEntries) Then
        For i = LBound(aEntries) To UBound(aEntries)
            sFileURL = aEntries(i)
            If Len(sFileURL) >= 4 Then
                If LCase(Right(sFileURL, 4)) = ".odp" Then
                    If bHasFile Then
                        ReDim Preserve vFiles(UBound(vFiles) + 1)
                    Else
                        bHasFile = True
                    End If
                    vFiles(UBound(vFiles)) = sFileURL
                End If
            End If
        Next i
    End If

    If Not bHasFile Then
        MsgBox "Aucun fichier .odp trouvé dans " & sDirectory & ".", 48, "ouvrirTout"
        Exit Sub
    End If

    sSofficePath = "C:\Program Files\LibreOffice\program\simpress.exe" 'CurDir$ 'GetSofficeExecutablePath()
    If Len(Trim(sSofficePath)) = 0 Then
        MsgBox "Impossible de localiser l'exécutable LibreOffice (soffice).", 16, "ouvrirTout"
        Exit Sub
    End If

    For i = 0 To UBound(vFiles) - 1
        For j = i + 1 To UBound(vFiles)
            If StrComp(vFiles(j), vFiles(i), 1) < 0 Then
                sFileURL = vFiles(i)
                vFiles(i) = vFiles(j)
                vFiles(j) = sFileURL
            End If
        Next j
    Next i

    For i = 0 To UBound(vFiles)
        sFileURL = vFiles(i)
        sDisplayName = ConvertFromURL(sFileURL)

      
        sCommand = """" & sSofficePath & """"
        If Len(param) > 0 Then
            sCommand = sCommand & " --" & param
        End If
        sCommand = sCommand & " """ & sDisplayName & """"
        
        
        nShellResult = Shell(sCommand, 1)

        If i < UBound(vFiles) Then
            sNextDisplayName = ConvertFromURL(vFiles(i + 1))
            nAnswer = MsgBox("Ouvrir le fichier suivant ?" & Chr(13) & sNextDisplayName, 36, "ouvrirTout")
            If nAnswer = 7 Then
                Exit For
            End If
        End If
    Next i

    Exit Sub

ErrorHandler:
    MsgBox "Erreur dans ouvrirTout : " & Err.Description, 16, "ouvrirTout"
End Sub

Private Function GetSofficeExecutablePath() As String
    On Error GoTo Fail

    Dim oPathSubst As Object
    Dim sProgDirUrl As String
    Dim sProgDir As String
    Dim sSep As String
    Dim sExe As String

    oPathSubst = createUnoService("com.sun.star.util.PathSubstitution")
    If oPathSubst Is Nothing Then GoTo Fail

    sProgDirUrl = oPathSubst.substituteVariables("$(progdir)")
    If Len(Trim(sProgDirUrl)) = 0 Then GoTo Fail

    sProgDir = ConvertFromURL(sProgDirUrl)
    If Len(Trim(sProgDir)) = 0 Then GoTo Fail

    sSep = GetPathSeparator()
    If Right$(sProgDir, Len(sSep)) <> sSep Then
        sProgDir = sProgDir & sSep
    End If

    If InStr(sSep, "\") > 0 Then
        sExe = "soffice.exe"
    Else
        sExe = "soffice"
    End If

    GetSofficeExecutablePath = sProgDir & sExe
    Exit Function

Fail:
    GetSofficeExecutablePath = ""
End Function

Private Sub SetPropertyIfAvailable(oTarget As Object, sName As String, vValue As Variant)
    On Error GoTo HandleError

    If HasUnoInterfaces(oTarget, "com.sun.star.beans.XPropertySet") Then
        Dim oPropSet As Object
        Dim oInfo As Object
        oPropSet = oTarget
        oInfo = oPropSet.getPropertySetInfo()

        If oInfo.hasPropertyByName(sName) Then
            oPropSet.setPropertyValue sName, vValue
        Else
             MsgBox "la propriété " & sName & " est introuvable.", 48, "Modif Diaporama"
        End If
    End If
    Exit Sub

HandleError:
    MsgBox "Impossible d'appliquer la propriété """ & sName & """ : " & Err.Description, 16, "Erreur propriété UNO"
    Err.Clear
    On Error GoTo 0
End Sub
